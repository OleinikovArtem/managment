import { beforeEach, describe, expect, it, vi } from "vitest";

const { transaction, prismaTransaction, queryRaw, counts } = vi.hoisted(() => {
  const count = () => vi.fn().mockResolvedValue(2);
  const counts = {
    memberPayment: { count: count() },
    paymentAllocation: { count: count() },
    ledgerTransaction: { count: count() },
    ledgerEntry: { count: count() },
    saleTransaction: { count: count() },
    saleShare: { count: count() },
    lootDrop: { count: count() },
    raid: { count: count() },
    raidParticipant: { count: count() },
    partyComposition: { count: count() },
    partyCompositionMember: { count: count() },
    partyMember: { count: count() },
    partyMemberProfile: { count: count() },
    telegramSaleImport: { count: count() },
  };
  const queryRaw = vi.fn();
  const transaction = { ...counts, $queryRaw: queryRaw };
  const prismaTransaction = vi.fn();
  return { transaction, prismaTransaction, queryRaw, counts };
});

vi.mock("server-only", () => ({}));
vi.mock("@/generated/prisma/client", () => ({
  Prisma: { TransactionIsolationLevel: { RepeatableRead: "RepeatableRead" } },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: prismaTransaction } }));

import { previewPartyReset } from "@/server/repositories/party-repository";

describe("party reset preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const model of Object.values(counts)) model.count.mockResolvedValue(2);
    prismaTransaction.mockImplementation(async (callback) => callback(transaction));
  });

  it("counts only rows touched by the resolved selection in a repeatable-read transaction", async () => {
    const result = await previewPartyReset("party-a", ["sales"]);

    expect(result.categories).toEqual(["sales", "payments"]);
    expect(result.counts).toMatchObject({
      payments: 2,
      paymentAllocations: 2,
      ledgerTransactions: 2,
      ledgerEntries: 2,
      sales: 2,
      saleShares: 2,
      telegramProcessed: 2,
      telegramPending: 2,
      loot: 0,
      raids: 0,
      compositions: 0,
      members: 0,
    });
    expect(queryRaw).toHaveBeenCalledOnce();
    expect(prismaTransaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: "RepeatableRead" }),
    );
  });
});
