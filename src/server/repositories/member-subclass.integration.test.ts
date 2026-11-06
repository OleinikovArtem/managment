import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const testUrl = process.env.TEST_DATABASE_URL;
let disconnect: (() => Promise<void>) | undefined;
afterAll(async () => { await disconnect?.(); });

describe.skipIf(!testUrl?.startsWith("postgres"))("Main and Subclass persistence on disposable PostgreSQL", () => {
  it("persists fixed slots, archives removed subclasses and preserves financial snapshots", async () => {
    process.env.DATABASE_URL = testUrl;
    const [{ prisma }, repo, profiles, { registerPartySale }] = await Promise.all([
      import("@/lib/db/prisma"), import("./party-member-repository"), import("./member-profile-repository"), import("./sale-repository"),
    ]);
    disconnect = () => prisma.$disconnect();
    const partyId = `classes-${randomUUID()}`;
    await prisma.party.create({ data: { id: partyId, name: "Classes" } });
    const member = await repo.createPartyMemberRecord(partyId, { nickname: "Korsa", distributionWeight: 1, className: "Grand Khavatari", subclasses: [{ slot: 1, className: "Cardinal" }, { slot: 4, className: "Doombringer" }] }, "korsa");
    await prisma.partyMember.update({ where: { id: member.id }, data: { level: 85 } });
    let active = await profiles.listPartyMemberProfiles(partyId);
    expect(active.map(profile => [profile.subclassSlot, profile.className])).toEqual([[1, "Cardinal"], [4, "Doombringer"]]);
    const healer = active[0], kamael = active[1];
    await prisma.partyMemberProfile.update({ where: { id: healer.id }, data: { level: 80 } });
    const composition = await prisma.partyComposition.create({ data: { partyId, name: "Mages" } });
    await prisma.partyCompositionMember.create({ data: { partyId, compositionId: composition.id, memberId: member.id, profileId: healer.id } });
    const raid = await prisma.raid.create({ data: { partyId, name: "Historical", occurredAt: new Date("2026-11-01T10:00:00Z") } });
    const participant = await prisma.raidParticipant.create({ data: { partyId, raidId: raid.id, memberId: member.id, profileId: healer.id, nicknameSnapshot: "Korsa", classSnapshot: "Cardinal", levelSnapshot: 80, status: "PRESENT", distributionWeight: 7 } });
    const item = await prisma.item.create({ data: { canonicalName: `Classes ${randomUUID()}`, normalizedName: randomUUID() } });
    const loot = await prisma.lootDrop.create({ data: { partyId, raidId: raid.id, itemId: item.id, quantity: 1 } });
    const sale = await registerPartySale(partyId, { lootDropId: loot.id, quantitySold: 1, totalPrice: 100n, receivedAt: new Date(), idempotencyKey: randomUUID() });
    await repo.updatePartyMemberRecord(partyId, member.id, { nickname: "Korsa", distributionWeight: 1, className: "Titan", subclasses: [{ slot: 1, id: healer.id, className: "Arcana Lord" }, { slot: 4, id: kamael.id, className: "Doombringer" }] }, "korsa");
    expect(await prisma.partyMember.findUnique({ where: { id: member.id } })).toMatchObject({ className: "Titan", level: 85 });
    expect(await prisma.partyMemberProfile.findUnique({ where: { id: healer.id } })).toMatchObject({ className: "Arcana Lord", level: 80, subclassSlot: 1 });
    // Clearing a class archives its profile and clears only future template links.
    await repo.updatePartyMemberRecord(partyId, member.id, { nickname: "Korsa", distributionWeight: 1, className: "Titan", subclasses: [{ slot: 1, id: healer.id, className: "" }, { slot: 4, id: kamael.id, className: "Doombringer" }] }, "korsa");
    expect(await prisma.partyMemberProfile.findUnique({ where: { id: healer.id } })).toMatchObject({ isActive: false });
    expect(await prisma.partyCompositionMember.findFirst({ where: { partyId } })).toMatchObject({ profileId: null });
    expect(await prisma.raidParticipant.findUnique({ where: { id: participant.id } })).toMatchObject({ profileId: healer.id, classSnapshot: "Cardinal", levelSnapshot: 80, distributionWeight: 7 });
    expect(await prisma.saleShare.findFirst({ where: { partyId, saleTransactionId: sale.id } })).toMatchObject({ amount: 100n, weightSnapshot: 7 });
    active = await profiles.listPartyMemberProfiles(partyId);
    expect(active.map(profile => [profile.subclassSlot, profile.className])).toEqual([[4, "Doombringer"]]);
    // Four racing legacy create calls can fill only the three available slots.
    const created = await Promise.allSettled([1, 2, 3, 4].map(index => profiles.createPartyMemberProfile(partyId, { memberId: member.id, name: `Concurrent ${index}`, className: "Trickster" })));
    expect(created.filter(result => result.status === "fulfilled")).toHaveLength(3);
    expect(await prisma.partyMemberProfile.count({ where: { partyId, memberId: member.id, isActive: true } })).toBe(4);
    // A foreign profile cannot be reassigned; the entire member edit rolls back.
    const otherPartyId = `classes-other-${randomUUID()}`;
    await prisma.party.create({ data: { id: otherPartyId, name: "Other" } });
    const other = await repo.createPartyMemberRecord(otherPartyId, { nickname: "Other", distributionWeight: 1, subclasses: [{ slot: 1, className: "Cardinal" }] }, "other");
    const foreign = await prisma.partyMemberProfile.findFirstOrThrow({ where: { memberId: other.id } });
    await expect(repo.updatePartyMemberRecord(partyId, member.id, { nickname: "Stolen", distributionWeight: 1, subclasses: [{ id: foreign.id, slot: 1, className: "Cardinal" }] }, "stolen")).rejects.toThrow();
    expect(await prisma.partyMember.findUnique({ where: { id: member.id } })).toMatchObject({ nickname: "Korsa", className: "Titan" });
  }, 90_000);
});
