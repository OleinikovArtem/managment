import "server-only";

import { Prisma, type Prisma as PrismaTypes } from "@/generated/prisma/client";
import {
  LedgerAccountType,
  LedgerTransactionStatus,
  LedgerTransactionType,
} from "@/generated/prisma/enums";
import {
  PaymentIdempotencyConflictError,
  PaymentOperationError,
  PaymentTemporaryDatabaseError,
} from "@/features/sales/payment-errors";
import { prisma } from "@/lib/db/prisma";

type Transaction = PrismaTypes.TransactionClient;

const RETRY_DELAYS_MS = [40, 120] as const;
const MAX_TRANSACTION_ATTEMPTS = RETRY_DELAYS_MS.length + 1;

export type PaymentRecordInput = {
  memberId: string;
  amount: bigint;
  paidAt: Date;
  comment?: string;
  idempotencyKey: string;
};

function isRetryableDatabaseError(error: unknown): boolean {
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

  return /40001|40P01|sockettimeout|operation has timed out|P2034/i.test(messages.join("\n"));
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

type ExistingPayment = {
  memberId: string;
  amount: bigint;
  paidAt: Date;
  comment: string | null;
};

function resolveExistingPayment(existing: ExistingPayment, input: PaymentRecordInput) {
  if (
    existing.memberId !== input.memberId ||
    existing.amount !== input.amount ||
    existing.paidAt.getTime() !== input.paidAt.getTime() ||
    (existing.comment ?? undefined) !== input.comment
  ) {
    throw new PaymentIdempotencyConflictError();
  }
  return existing;
}

async function findExistingPayment(partyId: string, idempotencyKey: string) {
  return prisma.memberPayment.findUnique({
    where: { partyId_idempotencyKey: { partyId, idempotencyKey } },
    include: { allocations: { orderBy: { saleShareId: "asc" } } },
  });
}

function resolveExistingPaymentRecord(
  existing: NonNullable<Awaited<ReturnType<typeof findExistingPayment>>>,
  input: PaymentRecordInput,
) {
  resolveExistingPayment(existing, input);
  return existing;
}

async function createPartyPaymentRecord(
  transaction: Transaction,
  partyId: string,
  input: PaymentRecordInput,
) {
  const existing = await transaction.memberPayment.findUnique({
    where: { partyId_idempotencyKey: { partyId, idempotencyKey: input.idempotencyKey } },
    include: { allocations: { orderBy: { saleShareId: "asc" } } },
  });
  if (existing) return resolveExistingPaymentRecord(existing, input);

  const member = await transaction.partyMember.findFirst({
    where: { partyId, id: input.memberId },
    select: { id: true, nickname: true },
  });
  if (!member) {
    throw new PaymentOperationError("Участник не найден в этой группе.");
  }

  const shares = await transaction.saleShare.findMany({
    where: {
      partyId,
      memberId: member.id,
      amount: { gt: 0n },
      saleTransaction: {
        ledgerTransaction: { is: { status: LedgerTransactionStatus.POSTED } },
      },
    },
    select: {
      id: true,
      amount: true,
      createdAt: true,
      paymentAllocations: {
        where: {
          memberPayment: {
            ledgerTransaction: { is: { status: LedgerTransactionStatus.POSTED } },
          },
        },
        select: { amount: true },
      },
    },
    orderBy: [{ saleTransaction: { receivedAt: "asc" } }, { createdAt: "asc" }, { id: "asc" }],
  });

  let remaining = input.amount;
  const allocations: { saleShareId: string; amount: bigint }[] = [];
  for (const share of shares) {
    const alreadyPaid = share.paymentAllocations.reduce(
      (sum, allocation) => sum + allocation.amount,
      0n,
    );
    const unpaid = share.amount - alreadyPaid;
    if (unpaid <= 0n) continue;

    const allocated = remaining < unpaid ? remaining : unpaid;
    allocations.push({ saleShareId: share.id, amount: allocated });
    remaining -= allocated;
    if (remaining === 0n) break;
  }

  if (remaining !== 0n && shares.length === 0) {
    throw new PaymentOperationError(
      "Нельзя оформить выплату в долг: у участника ещё нет начисленной доли.",
    );
  }

  if (remaining !== 0n) {
    const lastAllocation = allocations.at(-1);
    if (!lastAllocation) {
      throw new PaymentOperationError("Не удалось учесть передачу в остатке доли участника.");
    }
    lastAllocation.amount += remaining;
    remaining = 0n;
  }

  const now = new Date();
  const payment = await transaction.memberPayment.create({
    data: {
      partyId,
      memberId: member.id,
      nicknameSnapshot: member.nickname,
      amount: input.amount,
      paidAt: input.paidAt,
      comment: input.comment || null,
      idempotencyKey: input.idempotencyKey,
      createdAt: now,
    },
  });

  await transaction.paymentAllocation.createMany({
    data: allocations.map((allocation) => ({
      partyId,
      memberId: member.id,
      memberPaymentId: payment.id,
      saleShareId: allocation.saleShareId,
      amount: allocation.amount,
      createdAt: now,
    })),
  });

  const ledger = await transaction.ledgerTransaction.create({
    data: {
      partyId,
      type: LedgerTransactionType.PAYOUT_POSTED,
      status: LedgerTransactionStatus.DRAFT,
      memberPaymentId: payment.id,
      createdAt: now,
    },
  });

  await transaction.ledgerEntry.createMany({
    data: [
      {
        partyId,
        ledgerTransactionId: ledger.id,
        accountType: LedgerAccountType.PARTY_CASH,
        partyMemberId: null,
        debit: 0n,
        credit: input.amount,
        createdAt: now,
      },
      {
        partyId,
        ledgerTransactionId: ledger.id,
        accountType: LedgerAccountType.MEMBER_PAYABLE,
        partyMemberId: member.id,
        debit: input.amount,
        credit: 0n,
        createdAt: now,
      },
    ],
  });

  await transaction.ledgerTransaction.update({
    where: { partyId_id: { partyId, id: ledger.id } },
    data: { status: LedgerTransactionStatus.POSTED, postedAt: now },
  });

  return transaction.memberPayment.findUniqueOrThrow({
    where: { partyId_id: { partyId, id: payment.id } },
    include: { allocations: { orderBy: { saleShareId: "asc" } } },
  });
}

export async function registerPartyPayment(partyId: string, input: PaymentRecordInput) {
  for (let attempt = 0; attempt < MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction((transaction) =>
        createPartyPaymentRecord(transaction, partyId, input),
      );
    } catch (error) {
      if (isRetryableDatabaseError(error)) {
        if (attempt < RETRY_DELAYS_MS.length) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
          continue;
        }
        throw new PaymentTemporaryDatabaseError();
      }

      if (isUniqueConstraintError(error)) {
        const existing = await findExistingPayment(partyId, input.idempotencyKey);
        if (existing) return resolveExistingPaymentRecord(existing, input);
      }
      throw error;
    }
  }

  throw new PaymentTemporaryDatabaseError();
}

export async function listPartyPayments(partyId: string) {
  return prisma.memberPayment.findMany({
    where: {
      partyId,
      ledgerTransaction: { is: { status: LedgerTransactionStatus.POSTED } },
    },
    include: {
      allocations: {
        include: {
          saleShare: {
            select: {
              nicknameSnapshot: true,
              saleTransaction: {
                select: {
                  receivedAt: true,
                  raid: { select: { id: true, name: true } },
                  lootDrop: {
                    include: {
                      item: { select: { displayName: true, canonicalName: true } },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { saleShareId: "asc" },
      },
    },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
  });
}
