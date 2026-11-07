import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  $transaction: vi.fn(),
  saleFindUnique: vi.fn(),
  saleFindUniqueOrThrow: vi.fn(),
  saleFindMany: vi.fn(),
  saleCreate: vi.fn(),
  lootDropFindFirst: vi.fn(),
  saleShareCreateMany: vi.fn(),
  ledgerTransactionCreate: vi.fn(),
  ledgerTransactionUpdate: vi.fn(),
  ledgerEntryCreateMany: vi.fn(),
  ledgerEntryFindMany: vi.fn(),
  ledgerTransactionFindMany: vi.fn(),
  raidUpdateMany: vi.fn(),
}));

const transaction = {
  $queryRaw: vi.fn().mockResolvedValue([]),
  raid: { updateMany: mocks.raidUpdateMany },
  saleTransaction: {
    findUnique: mocks.saleFindUnique,
    findUniqueOrThrow: mocks.saleFindUniqueOrThrow,
    create: mocks.saleCreate,
    aggregate: vi.fn(),
  },
  lootDrop: { findFirst: mocks.lootDropFindFirst },
  saleShare: { createMany: mocks.saleShareCreateMany },
  ledgerTransaction: {
    create: mocks.ledgerTransactionCreate,
    update: mocks.ledgerTransactionUpdate,
  },
  ledgerEntry: { createMany: mocks.ledgerEntryCreateMany },
};

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: mocks.$transaction,
    saleTransaction: {
      findUnique: mocks.saleFindUnique,
      findMany: mocks.saleFindMany,
    },
    ledgerEntry: { findMany: mocks.ledgerEntryFindMany },
    ledgerTransaction: { findMany: mocks.ledgerTransactionFindMany },
  },
}));

import {
  getPartyFinancialBalances,
  listPartyLedgerTransactions,
  registerPartySale,
  listPartySales,
} from "@/server/repositories/sale-repository";
import {
  SaleIdempotencyConflictError,
  SaleOperationError,
  SaleTemporaryDatabaseError,
} from "@/features/sales/sale-errors";

const input = {
  lootDropId: "drop-1",
  quantitySold: 2,
  totalPrice: 101n,
  receivedAt: new Date("2026-11-02T10:00:00.000Z"),
  idempotencyKey: "sale-key",
};

const lootDrop = {
  id: "drop-1",
  partyId: "party-1",
  raidId: "raid-1",
  quantity: 9,
  raid: {
    participants: [
      {
        id: "participant-a",
        memberId: "member-a",
        nicknameSnapshot: "A",
        distributionWeight: 1,
      },
      {
        id: "participant-b",
        memberId: "member-b",
        nicknameSnapshot: "B",
        distributionWeight: 1,
      },
    ],
  },
  saleTransactions: [{ quantitySold: 3 }],
};

describe("sale repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.$transaction.mockImplementation((callback) => callback(transaction));
    mocks.saleFindUnique.mockResolvedValue(null);
    mocks.lootDropFindFirst.mockResolvedValue(lootDrop);
    mocks.saleCreate.mockResolvedValue({ id: "sale-id" });
    mocks.saleShareCreateMany.mockResolvedValue({ count: 2 });
    mocks.ledgerTransactionCreate.mockResolvedValue({ id: "ledger-id" });
    mocks.ledgerTransactionUpdate.mockResolvedValue({});
    mocks.ledgerEntryCreateMany.mockResolvedValue({ count: 3 });
    mocks.saleFindUniqueOrThrow.mockResolvedValue({
      id: "sale-id",
      shares: [],
    });
  });

  it("writes equal shares, ledger and posting in one party-scoped transaction", async () => {
    await registerPartySale("party-1", input);

    expect(mocks.$transaction).toHaveBeenCalledOnce();
    expect(mocks.raidUpdateMany).toHaveBeenCalledWith({ where: { partyId: "party-1", id: "raid-1", lockedAt: null }, data: { lockedAt: expect.any(Date) } });
    expect(mocks.lootDropFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { partyId: "party-1", id: "drop-1" },
        include: expect.objectContaining({
          raid: expect.objectContaining({
            include: expect.objectContaining({
              participants: expect.objectContaining({
                where: { status: "PRESENT" },
              }),
            }),
          }),
        }),
      }),
    );
    expect(mocks.saleShareCreateMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          memberId: "member-a",
          amount: 51n,
          nicknameSnapshot: "A",
          weightSnapshot: 1,
        }),
        expect.objectContaining({
          memberId: "member-b",
          amount: 50n,
          nicknameSnapshot: "B",
          weightSnapshot: 1,
        }),
      ]),
    });
    const ledgerEntries = mocks.ledgerEntryCreateMany.mock.calls[0]?.[0].data;
    expect(ledgerEntries).toHaveLength(3);
    expect(ledgerEntries[0]).toMatchObject({
      accountType: "PARTY_CASH",
      debit: 101n,
      credit: 0n,
    });
    expect(ledgerEntries.slice(1).reduce((sum: bigint, entry: { credit: bigint }) => sum + entry.credit, 0n)).toBe(
      101n,
    );
    expect(mocks.ledgerTransactionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "POSTED" }),
      }),
    );
  });

  it("returns an existing sale when the idempotency key and parameters match", async () => {
    const existing = {
      id: "existing-sale",
      ...input,
      shares: [],
    };
    mocks.saleFindUnique.mockResolvedValue(existing);

    await expect(registerPartySale("party-1", input)).resolves.toBe(existing);
    expect(mocks.lootDropFindFirst).not.toHaveBeenCalled();
    expect(mocks.saleCreate).not.toHaveBeenCalled();
  });

  it("rejects reusing an idempotency key with different sale parameters", async () => {
    mocks.saleFindUnique.mockResolvedValue({
      id: "existing-sale",
      ...input,
      quantitySold: 1,
      shares: [],
    });

    await expect(registerPartySale("party-1", input)).rejects.toBeInstanceOf(
      SaleIdempotencyConflictError,
    );
  });

  it("rejects overselling before creating any financial records", async () => {
    mocks.lootDropFindFirst.mockResolvedValue({
      ...lootDrop,
      saleTransactions: [{ quantitySold: 8 }],
    });

    await expect(registerPartySale("party-1", input)).rejects.toBeInstanceOf(
      SaleOperationError,
    );
    expect(mocks.saleCreate).not.toHaveBeenCalled();
    expect(mocks.saleShareCreateMany).not.toHaveBeenCalled();
  });

  it("rejects distribution when the historical raid has no present participants", async () => {
    mocks.lootDropFindFirst.mockResolvedValue({
      ...lootDrop,
      raid: { participants: [] },
    });

    await expect(registerPartySale("party-1", input)).rejects.toThrow(
      "в рейде нет присутствовавших участников",
    );
    expect(mocks.saleCreate).not.toHaveBeenCalled();
    expect(mocks.ledgerTransactionCreate).not.toHaveBeenCalled();
  });

  it("does not report success when posting the ledger fails", async () => {
    mocks.ledgerTransactionUpdate.mockRejectedValue(new Error("ledger posting failed"));

    await expect(registerPartySale("party-1", input)).rejects.toThrow(
      "ledger posting failed",
    );
    expect(mocks.ledgerTransactionUpdate).toHaveBeenCalledOnce();
  });

  it("retries bounded PostgreSQL transaction conflicts around the whole transaction", async () => {
    mocks.$transaction
      .mockRejectedValueOnce(new Error("40001: serialization failure"))
      .mockImplementationOnce((callback) => callback(transaction));

    await registerPartySale("party-1", input);

    expect(mocks.$transaction).toHaveBeenCalledTimes(2);
  });

  it("returns an explicit temporary failure after exhausting lock retries", async () => {
    mocks.$transaction.mockRejectedValue(
      new Error("40P01: deadlock detected"),
    );

    await expect(registerPartySale("party-1", input)).rejects.toBeInstanceOf(
      SaleTemporaryDatabaseError,
    );
    expect(mocks.$transaction).toHaveBeenCalledTimes(3);
    expect(mocks.saleFindUnique).not.toHaveBeenCalled();
  });

  it("scopes sale history to the party", async () => {
    mocks.saleFindMany.mockResolvedValue([]);

    await listPartySales("party-1");

    expect(mocks.saleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { partyId: "party-1" } }),
    );
  });

  it("rebuilds Party cash and member payable balances from posted ledger entries", async () => {
    mocks.ledgerEntryFindMany.mockResolvedValue([
      {
        accountType: "PARTY_CASH",
        partyMemberId: null,
        debit: 100n,
        credit: 20n,
        partyMember: null,
      },
      {
        accountType: "MEMBER_PAYABLE",
        partyMemberId: "member-a",
        debit: 0n,
        credit: 70n,
        partyMember: { nickname: "A", isActive: false },
      },
      {
        accountType: "MEMBER_PAYABLE",
        partyMemberId: "member-a",
        debit: 10n,
        credit: 0n,
        partyMember: { nickname: "A", isActive: false },
      },
    ]);

    const balances = await getPartyFinancialBalances("party-1");

    expect(balances).toEqual({
      partyCash: 80n,
      memberBalances: [
        { memberId: "member-a", nickname: "A", isActive: false, payable: 60n },
      ],
    });
    expect(mocks.ledgerEntryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          partyId: "party-1",
          ledgerTransaction: { status: "POSTED" },
        },
      }),
    );
  });

  it("lists only posted ledger transactions scoped to the requested Party", async () => {
    mocks.ledgerTransactionFindMany.mockResolvedValue([]);

    await listPartyLedgerTransactions("party-1");

    expect(mocks.ledgerTransactionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { partyId: "party-1", status: "POSTED" },
        orderBy: [{ postedAt: "desc" }, { createdAt: "desc" }],
        include: expect.objectContaining({
          entries: expect.any(Object),
          saleTransaction: expect.objectContaining({
            include: expect.objectContaining({
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
            }),
          }),
          memberPayment: expect.any(Object),
        }),
      }),
    );
  });
});
