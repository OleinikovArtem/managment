import { createHash, randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const previousDatabaseUrl = process.env.DATABASE_URL;
let disconnectDatabase: (() => Promise<void>) | undefined;

afterAll(async () => {
  await disconnectDatabase?.();
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
});

describe.skipIf(!testDatabaseUrl?.startsWith("postgres"))("party data reset against disposable PostgreSQL", () => {
  it("clears only the selected dependency graph and preserves Telegram replay protection", async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    const [{ prisma }, { registerPartySale }, { registerPartyPayment }, { resetPartyData }, { receiveTelegramUpdate }] = await Promise.all([
      import("@/lib/db/prisma"), import("./sale-repository"), import("./payment-repository"), import("./party-repository"), import("@/server/telegram/import-service"),
    ]);
    disconnectDatabase = () => prisma.$disconnect();
    async function fixture() {
      const partyId = `selective-reset-${randomUUID()}`;
      await prisma.party.create({ data: { id: partyId, name: "Selective reset" } });
      const member = await prisma.partyMember.create({ data: { partyId, nickname: "Reset member", normalizedNickname: "reset member" } });
      const profile = await prisma.partyMemberProfile.create({ data: { partyId, memberId: member.id, name: "Main", className: "Cardinal" } });
      const composition = await prisma.partyComposition.create({ data: { partyId, name: "Reset comp" } });
      await prisma.partyCompositionMember.create({ data: { partyId, compositionId: composition.id, memberId: member.id, profileId: profile.id } });
      const raid = await prisma.raid.create({ data: { partyId, name: "Reset raid", compositionId: composition.id, occurredAt: new Date("2026-11-01T10:00:00Z") } });
      await prisma.raidParticipant.create({ data: { partyId, raidId: raid.id, memberId: member.id, profileId: profile.id, nicknameSnapshot: member.nickname, status: "PRESENT", distributionWeight: 1 } });
      const name = `Reset Item ${randomUUID()}`;
      const item = await prisma.item.create({ data: { canonicalName: name, normalizedName: name.toLowerCase() } });
      const drop = await prisma.lootDrop.create({ data: { partyId, raidId: raid.id, itemId: item.id, quantity: 2 } });
      const originalDate = new Date("2026-11-06T10:00:00Z");
      const sale = await registerPartySale(partyId, { lootDropId: drop.id, quantitySold: 1, totalPrice: 10n, receivedAt: originalDate, idempotencyKey: randomUUID() });
      await registerPartyPayment(partyId, { memberId: member.id, amount: 5n, paidAt: new Date(), idempotencyKey: randomUUID() });
      const webhookId = randomUUID();
      await prisma.partyTelegramBotConfig.create({ data: { partyId, encryptedToken: "test", initializationVector: "test", authenticationTag: "test", botId: String(Date.now()), webhookEnabled: true, webhookId, chatId: "42", senderId: "77" } });
      const rawText = `Successful sale\n${name} x1 @ 10 Adena`;
      for (const [index, status] of (["PROCESSED", "PENDING", "NEEDS_REVIEW"] as const).entries()) await prisma.telegramSaleImport.create({ data: {
        partyId, chatId: "42", senderId: "77", messageId: `forward:42:${index + 1}`, updateId: String(index), rawText,
        sourceHash: createHash("sha256").update(rawText).digest("hex"), receivedAt: originalDate, status,
        allocations: status === "PROCESSED" ? [{ lootDropId: drop.id, raidId: raid.id, raidName: raid.name, itemName: name, quantity: 1, amount: "10", saleId: sale.id }] : [],
      } });
      return { partyId, member, profile, composition, raid, item, drop, webhookId, originalDate, rawText };
    }
    const untouched = await fixture();
    // Fail after every deletion has executed, before COMMIT: the entire reset
    // must roll back, including ledger entries, profiles and lock changes.
    const rollback = await fixture();
    const originalTransaction = prisma.$transaction.bind(prisma);
    const failedTransaction = vi.spyOn(prisma, "$transaction").mockImplementationOnce((async (work: unknown, options?: Parameters<typeof prisma.$transaction>[1]) => {
      if (typeof work !== "function") throw new Error("Expected interactive transaction");
      return originalTransaction(async tx => {
        await work(tx);
        throw new Error("Injected reset failure before commit");
      }, options);
    }) as typeof prisma.$transaction);
    try {
      await expect(resetPartyData(rollback.partyId, ["members"])).rejects.toThrow("Injected reset failure");
    } finally { failedTransaction.mockRestore(); }
    expect(await prisma.memberPayment.count({ where: { partyId: rollback.partyId } })).toBe(1);
    expect(await prisma.saleTransaction.count({ where: { partyId: rollback.partyId } })).toBe(1);
    expect(await prisma.ledgerTransaction.count({ where: { partyId: rollback.partyId } })).toBe(2);
    expect(await prisma.partyMemberProfile.count({ where: { partyId: rollback.partyId } })).toBe(1);
    expect(await prisma.raid.findUnique({ where: { id: rollback.raid.id } })).toMatchObject({ lockedAt: expect.any(Date), compositionId: rollback.composition.id });
    for (const category of ["payments", "sales", "loot", "raids", "compositions"] as const) {
      const data = await fixture();
      const { partyId } = data;
      await resetPartyData(partyId, [category]);
      const clearsSales = ["sales", "loot", "raids"].includes(category);
      const clearsPayments = category !== "compositions";
      expect(await prisma.memberPayment.count({ where: { partyId } })).toBe(clearsPayments ? 0 : 1);
      expect(await prisma.paymentAllocation.count({ where: { partyId } })).toBe(clearsPayments ? 0 : 1);
      expect(await prisma.saleTransaction.count({ where: { partyId } })).toBe(clearsSales ? 0 : 1);
      expect(await prisma.saleShare.count({ where: { partyId } })).toBe(clearsSales ? 0 : 1);
      expect(await prisma.ledgerTransaction.count({ where: { partyId } })).toBe(clearsSales ? 0 : category === "payments" ? 1 : 2);
      expect(await prisma.lootDrop.count({ where: { partyId } })).toBe(category === "loot" || category === "raids" ? 0 : 1);
      expect(await prisma.raidParticipant.count({ where: { partyId } })).toBe(category === "raids" ? 0 : 1);
      expect(await prisma.raid.count({ where: { partyId } })).toBe(category === "raids" ? 0 : 1);
      expect(await prisma.partyComposition.count({ where: { partyId } })).toBe(category === "compositions" ? 0 : 1);
      expect(await prisma.partyMemberProfile.count({ where: { partyId } })).toBe(1);
      expect(await prisma.partyMember.count({ where: { partyId } })).toBe(1);
      expect(await prisma.item.findUnique({ where: { id: data.item.id } })).not.toBeNull();
      if (category === "compositions") {
        expect(await prisma.raid.findUnique({ where: { id: data.raid.id } })).toMatchObject({ compositionId: null });
        expect(await prisma.raidParticipant.findFirst({ where: { partyId } })).toMatchObject({ memberId: data.member.id, profileId: data.profile.id });
      }
      if (clearsSales) {
        expect(await prisma.telegramSaleImport.findMany({ where: { partyId }, orderBy: { messageId: "asc" } })).toMatchObject([
          { status: "PROCESSED", allocations: [], reason: expect.stringContaining("сбросе") }, { status: "IGNORED" }, { status: "IGNORED" },
        ]);
        await receiveTelegramUpdate(data.webhookId, { update_id: 99, message: {
          message_id: 99, date: Math.floor(Date.now() / 1000), chat: { id: 42, type: "private" }, from: { id: 42, is_bot: false }, text: data.rawText,
          forward_origin: { type: "user", date: data.originalDate.getTime() / 1000, sender_user: { id: 77, is_bot: true } },
        } });
        expect(await prisma.saleTransaction.count({ where: { partyId } })).toBe(0);
        if (category === "sales") {
          expect(await prisma.raid.findUnique({ where: { id: data.raid.id } })).toMatchObject({ lockedAt: null });
          await registerPartySale(partyId, { lootDropId: data.drop.id, quantitySold: 2, totalPrice: 20n, receivedAt: new Date(), idempotencyKey: randomUUID() });
          expect(await prisma.saleTransaction.count({ where: { partyId } })).toBe(1);
        }
      } else {
        const sale = await prisma.saleTransaction.findFirstOrThrow({ where: { partyId } });
        await expect(prisma.saleTransaction.update({ where: { id: sale.id }, data: { totalPrice: 99n } })).rejects.toThrow();
      }
    }
    expect(await prisma.saleTransaction.count({ where: { partyId: untouched.partyId } })).toBe(1);
    expect(await prisma.memberPayment.count({ where: { partyId: untouched.partyId } })).toBe(1);
    expect(await prisma.raid.count({ where: { partyId: untouched.partyId } })).toBe(1);
    await expect(resetPartyData(untouched.partyId, [])).rejects.toThrow();
  }, 120_000);

  it("removes history atomically and restores financial protections", async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    vi.resetModules();
    const [{ prisma }, { registerPartySale }, { registerPartyPayment }, { createPartyComposition, deletePartyComposition }, { resetPartyData }] =
      await Promise.all([
        import("@/lib/db/prisma"),
        import("@/server/repositories/sale-repository"),
        import("@/server/repositories/payment-repository"),
        import("@/server/repositories/composition-repository"),
        import("@/server/repositories/party-repository"),
      ]);
    disconnectDatabase = () => prisma.$disconnect();

    const partyId = `reset-party-${randomUUID()}`;
    await prisma.party.create({ data: { id: partyId, name: "Reset integration" } });
    const itemName = `Retained item ${randomUUID()}`;
    const item = await prisma.item.create({ data: { canonicalName: itemName, normalizedName: itemName.toLowerCase() } });
    const member = await prisma.partyMember.create({ data: { partyId, nickname: "Reset member", normalizedNickname: "reset member", distributionWeight: 1 } });
    const profile = await prisma.partyMemberProfile.create({ data: { partyId, memberId: member.id, name: "Main", className: "Cardinal" } });
    const composition = await createPartyComposition(partyId, { name: "Reset composition", slots: [{ memberId: member.id, profileId: profile.id }] });
    const raid = await prisma.raid.create({ data: { partyId, name: "Reset raid", compositionId: composition.id, occurredAt: new Date("2026-11-01T10:00:00Z") } });
    await expect(deletePartyComposition(partyId, composition.id)).resolves.toMatchObject({ count: 0, inUse: true });
    await prisma.raidParticipant.create({ data: { partyId, raidId: raid.id, memberId: member.id, profileId: profile.id, nicknameSnapshot: member.nickname, status: "PRESENT", distributionWeight: 1 } });
    const drop = await prisma.lootDrop.create({ data: { partyId, raidId: raid.id, itemId: item.id, quantity: 1 } });
    await registerPartySale(partyId, { lootDropId: drop.id, quantitySold: 1, totalPrice: 10n, receivedAt: new Date("2026-11-01T11:00:00Z"), idempotencyKey: randomUUID() });
    await registerPartyPayment(partyId, { memberId: member.id, amount: 10n, paidAt: new Date("2026-11-01T12:00:00Z"), idempotencyKey: randomUUID() });

    await resetPartyData(partyId, ["members"]);

    expect(await prisma.partyMember.count({ where: { partyId } })).toBe(0);
    expect(await prisma.partyMemberProfile.count({ where: { partyId } })).toBe(0);
    expect(await prisma.partyComposition.count({ where: { partyId } })).toBe(0);
    expect(await prisma.raid.count({ where: { partyId } })).toBe(0);
    expect(await prisma.saleTransaction.count({ where: { partyId } })).toBe(0);
    expect(await prisma.memberPayment.count({ where: { partyId } })).toBe(0);
    expect(await prisma.item.findUnique({ where: { id: item.id } })).not.toBeNull();
    expect(await prisma.party.count({ where: { id: partyId } })).toBe(1);
    const currentTriggerCount = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM information_schema.triggers WHERE trigger_schema = current_schema()`;
    expect(Number(currentTriggerCount[0]?.count)).toBeGreaterThan(0);
    await expect(prisma.partyMember.create({ data: { partyId, nickname: "Invalid", normalizedNickname: "invalid", distributionWeight: 0 } })).rejects.toThrow();
  });
});
