import { randomUUID } from "node:crypto";
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

    await resetPartyData(partyId);

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
