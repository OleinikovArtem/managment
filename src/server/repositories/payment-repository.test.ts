import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  $transaction: vi.fn(),
  paymentFindUnique: vi.fn(),
  paymentFindUniqueOrThrow: vi.fn(),
  paymentFindMany: vi.fn(),
  paymentCreate: vi.fn(),
  memberFindFirst: vi.fn(),
  ledgerEntryFindMany: vi.fn(),
  ledgerEntryCreateMany: vi.fn(),
  shareFindMany: vi.fn(),
  allocationCreateMany: vi.fn(),
  ledgerCreate: vi.fn(),
  ledgerUpdate: vi.fn(),
}));

const transaction = {
  memberPayment: {
    findUnique: mocks.paymentFindUnique,
    findUniqueOrThrow: mocks.paymentFindUniqueOrThrow,
    create: mocks.paymentCreate,
  },
  partyMember: { findFirst: mocks.memberFindFirst },
  ledgerEntry: {
    findMany: mocks.ledgerEntryFindMany,
    createMany: mocks.ledgerEntryCreateMany,
  },
  saleShare: { findMany: mocks.shareFindMany },
  paymentAllocation: { createMany: mocks.allocationCreateMany },
  ledgerTransaction: { create: mocks.ledgerCreate, update: mocks.ledgerUpdate },
};

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: mocks.$transaction,
    memberPayment: {
      findUnique: mocks.paymentFindUnique,
      findMany: mocks.paymentFindMany,
    },
  },
}));

import {
  listPartyPayments,
  registerPartyPayment,
} from "@/server/repositories/payment-repository";
import {
  PaymentIdempotencyConflictError,
  PaymentOperationError,
  PaymentTemporaryDatabaseError,
} from "@/features/sales/payment-errors";

const input = {
  memberId: "member-1",
  amount: 90n,
  paidAt: new Date("2026-11-02T10:00:00.000Z"),
  comment: "Cash",
  idempotencyKey: "payment-key",
};

const shares = [
  {
    id: "share-old",
    amount: 100n,
    createdAt: new Date("2026-10-01T10:00:00.000Z"),
    paymentAllocations: [{ amount: 40n }],
  },
  {
    id: "share-new",
    amount: 80n,
    createdAt: new Date("2026-10-02T10:00:00.000Z"),
    paymentAllocations: [],
  },
];

describe("payment repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.$transaction.mockImplementation((callback) => callback(transaction));
    mocks.paymentFindUnique.mockResolvedValue(null);
    mocks.memberFindFirst.mockResolvedValue({ id: "member-1", nickname: "Hero" });
    mocks.ledgerEntryFindMany.mockResolvedValue([
      { accountType: "PARTY_CASH", partyMemberId: null, debit: 150n, credit: 0n },
      { accountType: "MEMBER_PAYABLE", partyMemberId: "member-1", debit: 40n, credit: 180n },
    ]);
    mocks.shareFindMany.mockResolvedValue(shares);
    mocks.paymentCreate.mockResolvedValue({ id: "payment-1" });
    mocks.allocationCreateMany.mockResolvedValue({ count: 2 });
    mocks.ledgerCreate.mockResolvedValue({ id: "ledger-1" });
    mocks.ledgerEntryCreateMany.mockResolvedValue({ count: 2 });
    mocks.ledgerUpdate.mockResolvedValue({});
    mocks.paymentFindUniqueOrThrow.mockResolvedValue({
      id: "payment-1",
      memberId: "member-1",
      nicknameSnapshot: "Hero",
      amount: 90n,
      paidAt: input.paidAt,
      allocations: [
        { saleShareId: "share-old", amount: 60n },
        { saleShareId: "share-new", amount: 30n },
      ],
    });
  });

  it("allocates FIFO across the oldest outstanding shares and posts a balanced ledger", async () => {
    await registerPartyPayment("party-1", input);

    expect(mocks.shareFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          partyId: "party-1",
          memberId: "member-1",
          amount: { gt: 0n },
          saleTransaction: {
            ledgerTransaction: { is: { status: "POSTED" } },
          },
        }),
        orderBy: [
          { saleTransaction: { receivedAt: "asc" } },
          { createdAt: "asc" },
          { id: "asc" },
        ],
      }),
    );
    expect(mocks.allocationCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ saleShareId: "share-old", amount: 60n }),
        expect.objectContaining({ saleShareId: "share-new", amount: 30n }),
      ],
    });
    expect(mocks.ledgerEntryCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          accountType: "PARTY_CASH",
          debit: 0n,
          credit: 90n,
        }),
        expect.objectContaining({
          accountType: "MEMBER_PAYABLE",
          partyMemberId: "member-1",
          debit: 90n,
          credit: 0n,
        }),
      ],
    });
    expect(mocks.ledgerUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "POSTED" }),
      }),
    );
  });

  it("rejects a payment greater than available Party cash before writing", async () => {
    mocks.ledgerEntryFindMany.mockResolvedValue([
      { accountType: "PARTY_CASH", partyMemberId: null, debit: 50n, credit: 0n },
    ]);

    await expect(registerPartyPayment("party-1", input)).rejects.toBeInstanceOf(
      PaymentOperationError,
    );
    expect(mocks.paymentCreate).not.toHaveBeenCalled();
  });

  it("rejects a payment greater than the member's outstanding payable", async () => {
    mocks.ledgerEntryFindMany.mockResolvedValue([
      { accountType: "PARTY_CASH", partyMemberId: null, debit: 150n, credit: 0n },
      { accountType: "MEMBER_PAYABLE", partyMemberId: "member-1", debit: 100n, credit: 100n },
    ]);

    await expect(registerPartyPayment("party-1", input)).rejects.toBeInstanceOf(
      PaymentOperationError,
    );
    expect(mocks.paymentCreate).not.toHaveBeenCalled();
  });

  it("reuses an idempotent request and rejects a different request with the same key", async () => {
    const existing = {
      ...input,
      id: "existing",
      comment: "Cash",
      allocations: [],
    };
    mocks.paymentFindUnique.mockResolvedValue(existing);
    await expect(registerPartyPayment("party-1", input)).resolves.toBe(existing);
    expect(mocks.paymentCreate).not.toHaveBeenCalled();

    mocks.paymentFindUnique.mockResolvedValue({ ...existing, amount: 80n });
    await expect(registerPartyPayment("party-1", input)).rejects.toBeInstanceOf(
      PaymentIdempotencyConflictError,
    );
  });

  it("does not report success when ledger posting fails", async () => {
    mocks.ledgerUpdate.mockRejectedValue(new Error("ledger posting failed"));

    await expect(registerPartyPayment("party-1", input)).rejects.toThrow(
      "ledger posting failed",
    );
  });

  it("returns an explicit temporary error after bounded lock retries", async () => {
    mocks.$transaction.mockRejectedValue(
      new Error("SQLITE_BUSY: database is locked"),
    );

    await expect(registerPartyPayment("party-1", input)).rejects.toBeInstanceOf(
      PaymentTemporaryDatabaseError,
    );
    expect(mocks.$transaction).toHaveBeenCalledTimes(3);
  });

  it("lists payment history only within the requested Party", async () => {
    mocks.paymentFindMany.mockResolvedValue([]);

    await listPartyPayments("party-1");

    expect(mocks.paymentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          partyId: "party-1",
          ledgerTransaction: { is: { status: "POSTED" } },
        },
        orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      }),
    );
  });
});
