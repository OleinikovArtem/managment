import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const previousDatabaseUrl = process.env.DATABASE_URL;
let disconnectDatabase: (() => Promise<void>) | undefined;

afterAll(async () => {
  await disconnectDatabase?.();
  if (previousDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = previousDatabaseUrl;
  }
});

describe.skipIf(!testDatabaseUrl?.startsWith("postgres"))(
  "financial workflows against disposable PostgreSQL",
  () => {
    it("serializes concurrent sales and payments while preserving FIFO history", async () => {
      process.env.DATABASE_URL = testDatabaseUrl;
      vi.resetModules();

      const [{ prisma }, { registerPartySale }, { registerPartyPayment }] = await Promise.all([
        import("@/lib/db/prisma"),
        import("@/server/repositories/sale-repository"),
        import("@/server/repositories/payment-repository"),
      ]);
      disconnectDatabase = () => prisma.$disconnect();

      const partyId = `integration-party-${randomUUID()}`;
      await prisma.party.create({
        data: { id: partyId, name: "Financial Integration" },
      });
      const member = await prisma.partyMember.create({
        data: {
          partyId,
          nickname: "Original",
          normalizedNickname: "original",
          distributionWeight: 1,
        },
      });
      const itemName = `Integration Item ${randomUUID()}`;
      const item = await prisma.item.create({
        data: {
          canonicalName: itemName,
          normalizedName: itemName.toLowerCase(),
        },
      });

      async function createDrop(index: number) {
        const raid = await prisma.raid.create({
          data: {
            partyId,
            name: `Integration Raid ${index}`,
            occurredAt: new Date(`2026-10-${String(index + 1).padStart(2, "0")}T10:00:00Z`),
          },
        });
        await prisma.raidParticipant.create({
          data: {
            partyId,
            raidId: raid.id,
            memberId: member.id,
            nicknameSnapshot: member.nickname,
            status: "PRESENT",
            distributionWeight: 1,
          },
        });
        return prisma.lootDrop.create({
          data: { partyId, raidId: raid.id, itemId: item.id, quantity: 1 },
        });
      }

      const oldestDrop = await createDrop(0);
      const newerDrop = await createDrop(1);
      const duplicateRequestDrop = await createDrop(2);
      const duplicateRequest = {
        lootDropId: duplicateRequestDrop.id,
        quantitySold: 1,
        totalPrice: 50n,
        receivedAt: new Date("2026-11-02T10:00:00Z"),
        idempotencyKey: randomUUID(),
      };
      const duplicateCalls = await Promise.all([
        registerPartySale(partyId, duplicateRequest),
        registerPartySale(partyId, duplicateRequest),
      ]);
      expect(duplicateCalls[0]?.id).toBe(duplicateCalls[1]?.id);

      const contestedDrop = await createDrop(3);
      await registerPartySale(partyId, {
        lootDropId: oldestDrop.id,
        quantitySold: 1,
        totalPrice: 100n,
        receivedAt: new Date("2026-11-02T09:00:00Z"),
        idempotencyKey: randomUUID(),
      });
      await new Promise((resolve) => setTimeout(resolve, 20));
      await registerPartySale(partyId, {
        lootDropId: newerDrop.id,
        quantitySold: 1,
        totalPrice: 80n,
        receivedAt: new Date("2026-11-02T09:30:00Z"),
        idempotencyKey: randomUUID(),
      });

      const concurrentSales = await Promise.allSettled(
        [60n, 70n].map((totalPrice) =>
          registerPartySale(partyId, {
            lootDropId: contestedDrop.id,
            quantitySold: 1,
            totalPrice,
            receivedAt: new Date("2026-11-02T11:00:00Z"),
            idempotencyKey: randomUUID(),
          }),
        ),
      );
      expect(concurrentSales.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
      expect(concurrentSales.filter(({ status }) => status === "rejected")).toHaveLength(1);

      const firstPayment = {
        memberId: member.id,
        amount: 150n,
        paidAt: new Date("2026-11-02T13:00:00Z"),
        idempotencyKey: randomUUID(),
      };
      const payment = await registerPartyPayment(partyId, firstPayment);
      expect(payment.allocations.map(({ amount }) => amount)).toEqual([100n, 50n]);
      await expect(registerPartyPayment(partyId, firstPayment)).resolves.toMatchObject({
        id: payment.id,
      });

      await registerPartyPayment(partyId, {
        memberId: member.id,
        amount: 120n,
        paidAt: new Date("2026-11-02T13:30:00Z"),
        idempotencyKey: randomUUID(),
      });

      const concurrentPayouts = await Promise.allSettled(
        [20n, 20n].map((amount) =>
          registerPartyPayment(partyId, {
            memberId: member.id,
            amount,
            paidAt: new Date("2026-11-02T14:00:00Z"),
            idempotencyKey: randomUUID(),
          }),
        ),
      );
      expect(concurrentPayouts.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
      expect(concurrentPayouts.filter(({ status }) => status === "rejected")).toHaveLength(1);

      await prisma.partyMember.update({
        where: { partyId_id: { partyId, id: member.id } },
        data: { nickname: "Renamed", normalizedNickname: "renamed", isActive: false },
      });

      const sales = await prisma.saleTransaction.findMany({ where: { partyId } });
      expect(sales).toHaveLength(4);
      const totalSales = sales.reduce((sum, sale) => sum + sale.totalPrice, 0n);
      const payments = await prisma.memberPayment.findMany({
        where: { partyId },
        orderBy: { createdAt: "asc" },
      });
      const paidBeforeFinal = payments.reduce((sum, entry) => sum + entry.amount, 0n);
      const outstandingBeforeFinalPayment = totalSales - paidBeforeFinal;
      if (outstandingBeforeFinalPayment > 0n) {
        await registerPartyPayment(partyId, {
          memberId: member.id,
          amount: outstandingBeforeFinalPayment,
          paidAt: new Date("2026-11-02T15:00:00Z"),
          idempotencyKey: randomUUID(),
        });
      }

      const finalPayments = await prisma.memberPayment.findMany({
        where: { partyId },
        orderBy: { createdAt: "asc" },
      });
      const totalPayments = finalPayments.reduce((sum, entry) => sum + entry.amount, 0n);
      const entries = await prisma.ledgerEntry.findMany({
        where: { partyId, ledgerTransaction: { status: "POSTED" } },
      });
      expect(finalPayments.length).toBeGreaterThanOrEqual(3);
      expect(payments[0]?.nicknameSnapshot).toBe("Original");
      const cashBalance = entries.reduce(
        (sum, entry) =>
          entry.accountType === "PARTY_CASH" ? sum + entry.debit - entry.credit : sum,
        0n,
      );
      const memberPayable = entries.reduce(
        (sum, entry) =>
          entry.accountType === "MEMBER_PAYABLE" && entry.partyMemberId === member.id
            ? sum + entry.credit - entry.debit
            : sum,
        0n,
      );
      expect(cashBalance).toBe(totalSales - totalPayments);
      expect(cashBalance).toBeGreaterThanOrEqual(0n);
      expect(memberPayable).toBe(0n);
    }, 30_000);
  },
);
