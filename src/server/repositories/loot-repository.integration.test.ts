import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const testUrl = process.env.TEST_DATABASE_URL;
let disconnect: (() => Promise<void>) | undefined;
afterAll(async () => { await disconnect?.(); });

describe.skipIf(!testUrl?.startsWith("postgres"))("Loot list on disposable PostgreSQL", () => {
  it("isolates parties, orders by receipt creation and sums partial/multiple sales exactly", async () => {
    process.env.DATABASE_URL = testUrl;
    const [{ prisma }, { listPartyLoot }, { createPartySaleRecord }] = await Promise.all([
      import("@/lib/db/prisma"), import("./loot-repository"), import("./sale-repository"),
    ]);
    disconnect = () => prisma.$disconnect();
    const partyId = `loot-${randomUUID()}`, otherId = `loot-other-${randomUUID()}`;
    await prisma.party.createMany({ data: [{ id: partyId, name: "Loot list" }, { id: otherId, name: "Other loot" }] });
    const item = await prisma.item.create({ data: { canonicalName: `Loot ${randomUUID()}`, normalizedName: randomUUID(), displayName: "Лут для теста" } });
    const member = await prisma.partyMember.create({ data: { partyId, nickname: "Loot Member", normalizedNickname: "loot member" } });
    const raid = await prisma.raid.create({ data: { partyId, name: "Loot Raid", occurredAt: new Date("2026-11-01T10:00:00Z") } });
    await prisma.raidParticipant.create({ data: { partyId, raidId: raid.id, memberId: member.id, nicknameSnapshot: member.nickname, status: "PRESENT", distributionWeight: 1 } });
    const drops = [];
    for (const [index, quantity] of [5, 3, 4].entries()) {
      drops.push(await prisma.lootDrop.create({ data: { partyId, raidId: raid.id, itemId: item.id, quantity, createdAt: new Date(`2026-11-0${index + 2}T10:00:00Z`) } }));
    }
    const foreignRaid = await prisma.raid.create({ data: { partyId: otherId, name: "Foreign", occurredAt: new Date() } });
    await prisma.lootDrop.create({ data: { partyId: otherId, raidId: foreignRaid.id, itemId: item.id, quantity: 99 } });
    const amounts = [9007199254740993n, 7n, 300n];
    for (const [index, lootDropId] of [drops[0].id, drops[0].id, drops[1].id].entries()) {
      await prisma.$transaction(tx => createPartySaleRecord(tx, partyId, {
        lootDropId, quantitySold: index === 2 ? 3 : 1, totalPrice: amounts[index],
        receivedAt: new Date("2026-11-05T10:00:00Z"), idempotencyKey: randomUUID(), comment: "Loot list test",
      }));
    }
    const rows = await listPartyLoot(partyId);
    expect(rows.map(row => row.id)).toEqual([drops[2].id, drops[1].id, drops[0].id]);
    expect(rows.map(row => [row.quantity, row.sold, row.remaining, row.status, row.proceeds])).toEqual([
      [4, 0, 4, "unsold", "0"], [3, 3, 0, "sold", "300"], [5, 2, 3, "partial", "9007199254741000"],
    ]);
    expect(rows.every(row => row.raidId === raid.id && row.name === "Лут для теста")).toBe(true);
    expect(await listPartyLoot(`missing-${randomUUID()}`)).toEqual([]);
  }, 90_000);
});
