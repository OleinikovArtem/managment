import "server-only";
import { lockParty } from "./catalog-locks";

import { Prisma, type Prisma as PrismaTypes } from "@/generated/prisma/client";
import {
  DistributionMethod,
  LedgerAccountType,
  LedgerTransactionStatus,
  LedgerTransactionType,
  RaidParticipantStatus,
} from "@/generated/prisma/enums";
import {
  SaleIdempotencyConflictError,
  SaleOperationError,
  SaleTemporaryDatabaseError,
} from "@/features/sales/sale-errors";
import { prisma } from "@/lib/db/prisma";
import { calculateWeightedShares } from "@/server/services/sale-distribution";

type Transaction = PrismaTypes.TransactionClient;

const RETRY_DELAYS_MS = [40, 120] as const;
const MAX_TRANSACTION_ATTEMPTS = RETRY_DELAYS_MS.length + 1;
const DISTRIBUTION_ALGORITHM_VERSION = 1;

type SaleRecordInput = {
  lootDropId: string;
  quantitySold: number;
  totalPrice: bigint;
  receivedAt: Date;
  comment?: string;
  idempotencyKey: string;
};

export function isRetryableDatabaseError(error: unknown): boolean {
  const messages: string[] = [];
  const pending: unknown[] = [error];
  const visited = new Set<object>();

  while (pending.length > 0) {
    const current = pending.pop();
    if (typeof current === "string") {
      messages.push(current);
      continue;
    }
    if (typeof current !== "object" || current === null || visited.has(current)) {
      continue;
    }
    visited.add(current);

    const record = current as Record<string, unknown>;
    if (typeof record.message === "string") messages.push(record.message);
    if (typeof record.code === "string") messages.push(record.code);
    if (record.cause) pending.push(record.cause);
    if (record.originalError) pending.push(record.originalError);
  }

  return /40001|40P01|sockettimeout|operation has timed out|P2034/i.test(
    messages.join("\n"),
  );
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function saleMatchesInput(
  existing: {
    lootDropId: string;
    quantitySold: number;
    totalPrice: bigint;
    receivedAt: Date;
    comment?: string | null;
  },
  input: SaleRecordInput,
): boolean {
  return (
    existing.lootDropId === input.lootDropId &&
    existing.quantitySold === input.quantitySold &&
    existing.totalPrice === input.totalPrice &&
    existing.receivedAt.getTime() === input.receivedAt.getTime() &&
    (existing.comment ?? undefined) === input.comment
  );
}

async function findExistingSale(partyId: string, idempotencyKey: string) {
  return prisma.saleTransaction.findUnique({
    where: { partyId_idempotencyKey: { partyId, idempotencyKey } },
    include: { shares: { orderBy: { memberId: "asc" } } },
  });
}

function resolveExistingSale(
  existing: NonNullable<Awaited<ReturnType<typeof findExistingSale>>>,
  input: SaleRecordInput,
) {
  if (!saleMatchesInput(existing, input)) {
    throw new SaleIdempotencyConflictError();
  }
  return existing;
}

export async function createPartySaleRecord(
  transaction: Transaction,
  partyId: string,
  input: SaleRecordInput,
) {
  await lockParty(transaction, partyId);
  const existing = await transaction.saleTransaction.findUnique({
    where: {
      partyId_idempotencyKey: {
        partyId,
        idempotencyKey: input.idempotencyKey,
      },
    },
    include: { shares: { orderBy: { memberId: "asc" } } },
  });
  if (existing) return resolveExistingSale(existing, input);

  const lootDrop = await transaction.lootDrop.findFirst({
    where: { partyId, id: input.lootDropId },
    include: {
      raid: {
        include: {
          participants: {
            where: { status: RaidParticipantStatus.PRESENT },
            orderBy: { id: "asc" },
          },
        },
      },
      saleTransactions: { select: { quantitySold: true } },
    },
  });
  if (!lootDrop) {
    throw new SaleOperationError("Выпадение не найдено в этой группе.");
  }

  const soldQuantity = lootDrop.saleTransactions.reduce(
    (sum, sale) => sum + sale.quantitySold,
    0,
  );
  if (input.quantitySold > lootDrop.quantity - soldQuantity) {
    throw new SaleOperationError("Количество продажи превышает оставшееся количество предметов.");
  }

  const participants = lootDrop.raid.participants;
  if (participants.length === 0) {
    throw new SaleOperationError("Нельзя распределить продажу: в рейде нет присутствовавших участников.");
  }

  const shares = calculateWeightedShares(
    input.totalPrice,
    participants.map((participant) => ({
      id: participant.id,
      memberId: participant.memberId,
      nicknameSnapshot: participant.nicknameSnapshot,
      // Preserve historical metadata required by the snapshot integrity checks;
      // current distribution still uses equal calculation weights below.
      sourceWeight: participant.distributionWeight,
      weight: 1,
    })),
  );
  const now = new Date();
  const sale = await transaction.saleTransaction.create({
    data: {
      partyId,
      raidId: lootDrop.raidId,
      lootDropId: lootDrop.id,
      quantitySold: input.quantitySold,
      totalPrice: input.totalPrice,
      receivedAt: input.receivedAt,
      comment: input.comment || null,
      idempotencyKey: input.idempotencyKey,
      distributionMethod: DistributionMethod.WEIGHTED,
      algorithmVersion: DISTRIBUTION_ALGORITHM_VERSION,
      createdAt: now,
    },
  });

  await transaction.saleShare.createMany({
    data: shares.map(({ participant, amount }) => ({
      partyId,
      raidId: lootDrop.raidId,
      saleTransactionId: sale.id,
      raidParticipantId: participant.id,
      memberId: participant.memberId,
      nicknameSnapshot: participant.nicknameSnapshot,
      weightSnapshot: participant.sourceWeight,
      distributionMethod: DistributionMethod.WEIGHTED,
      algorithmVersion: DISTRIBUTION_ALGORITHM_VERSION,
      amount,
      createdAt: now,
    })),
  });

  const ledger = await transaction.ledgerTransaction.create({
    data: {
      partyId,
      type: LedgerTransactionType.SALE_POSTED,
      status: LedgerTransactionStatus.DRAFT,
      saleTransactionId: sale.id,
      createdAt: now,
    },
  });

  const payableEntries = shares
    .filter(({ amount }) => amount > 0n)
    .map(({ participant, amount }) => ({
      partyId,
      ledgerTransactionId: ledger.id,
      accountType: LedgerAccountType.MEMBER_PAYABLE,
      partyMemberId: participant.memberId,
      debit: 0n,
      credit: amount,
      createdAt: now,
    }));

  await transaction.ledgerEntry.createMany({
    data: [
      {
        partyId,
        ledgerTransactionId: ledger.id,
        accountType: LedgerAccountType.PARTY_CASH,
        partyMemberId: null,
        debit: input.totalPrice,
        credit: 0n,
        createdAt: now,
      },
      ...payableEntries,
    ],
  });

  await transaction.ledgerTransaction.update({
    where: { partyId_id: { partyId, id: ledger.id } },
    data: {
      status: LedgerTransactionStatus.POSTED,
      postedAt: now,
    },
  });

  await transaction.raid.updateMany({
    where: { partyId, id: lootDrop.raidId, lockedAt: null },
    data: { lockedAt: now },
  });

  return transaction.saleTransaction.findUniqueOrThrow({
    where: { partyId_id: { partyId, id: sale.id } },
    include: { shares: { orderBy: { memberId: "asc" } } },
  });
}

export async function registerPartySale(partyId: string, input: SaleRecordInput) {
  for (let attempt = 0; attempt < MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction((transaction) =>
        createPartySaleRecord(transaction, partyId, input),
      );
    } catch (error) {
      if (isRetryableDatabaseError(error)) {
        if (attempt < RETRY_DELAYS_MS.length) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
          continue;
        }
        throw new SaleTemporaryDatabaseError();
      }

      if (isUniqueConstraintError(error)) {
        const existing = await findExistingSale(partyId, input.idempotencyKey);
        if (existing) return resolveExistingSale(existing, input);
      }
      throw error;
    }
  }

  throw new SaleTemporaryDatabaseError();
}

export async function listPartySales(partyId: string) {
  return prisma.saleTransaction.findMany({
    where: { partyId },
    include: {
      lootDrop: { include: { item: { select: { id: true, canonicalName: true, displayName: true, category: true } } } },
      raid: { select: { id: true, name: true, instanceName: true, occurredAt: true } },
      shares: { orderBy: { memberId: "asc" } },
    },
    orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function getPartyFinancialBalances(partyId: string) {
  const entries = await prisma.ledgerEntry.findMany({
    where: {
      partyId,
      ledgerTransaction: { status: LedgerTransactionStatus.POSTED },
    },
    select: {
      accountType: true,
      partyMemberId: true,
      debit: true,
      credit: true,
      partyMember: { select: { nickname: true, isActive: true } },
    },
  });

  let partyCash = 0n;
  const memberBalances = new Map<
    string,
    { nickname: string; isActive: boolean; payable: bigint }
  >();

  for (const entry of entries) {
    if (entry.accountType === LedgerAccountType.PARTY_CASH) {
      partyCash += entry.debit - entry.credit;
      continue;
    }

    if (
      entry.accountType === LedgerAccountType.MEMBER_PAYABLE &&
      entry.partyMemberId &&
      entry.partyMember
    ) {
      const current = memberBalances.get(entry.partyMemberId) ?? {
        nickname: entry.partyMember.nickname,
        isActive: entry.partyMember.isActive,
        payable: 0n,
      };
      current.payable += entry.credit - entry.debit;
      memberBalances.set(entry.partyMemberId, current);
    }
  }

  return {
    partyCash,
    memberBalances: [...memberBalances.entries()]
      .map(([memberId, balance]) => ({ memberId, ...balance }))
      .sort((left, right) => left.nickname.localeCompare(right.nickname)),
  };
}

export async function listPartyLedgerTransactions(partyId: string) {
  return prisma.ledgerTransaction.findMany({
    where: { partyId, status: LedgerTransactionStatus.POSTED },
    include: {
      entries: {
        orderBy: [{ accountType: "asc" }, { partyMemberId: "asc" }],
        include: { partyMember: { select: { nickname: true } } },
      },
      saleTransaction: {
        include: {
          raid: { select: { id: true, name: true } },
          lootDrop: {
            select: {
              item: {
                select: { canonicalName: true, displayName: true },
              },
            },
          },
          shares: {
            select: {
              memberId: true,
              nicknameSnapshot: true,
              amount: true,
              weightSnapshot: true,
              distributionMethod: true,
              algorithmVersion: true,
            },
          },
        },
      },
      memberPayment: {
        include: {
          allocations: {
            include: {
              saleShare: {
                select: {
                  saleTransaction: {
                    select: {
                      id: true,
                      raid: { select: { id: true, name: true } },
                      lootDrop: {
                        select: {
                          item: {
                            select: { canonicalName: true, displayName: true },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ postedAt: "desc" }, { createdAt: "desc" }],
  });
}
