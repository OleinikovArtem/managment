import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
let disconnectDatabase: (() => Promise<void>) | undefined;

afterAll(async () => {
  await disconnectDatabase?.();
});

describe.skipIf(!testDatabaseUrl?.startsWith("postgres"))(
  "composition profession overrides on disposable PostgreSQL",
  () => {
    it("round-trips an override into a raid class snapshot without changing the member profile", async () => {
      process.env.DATABASE_URL = testDatabaseUrl;
      const [{ prisma }, compositions, raids] = await Promise.all([
        import("@/lib/db/prisma"),
        import("./composition-repository"),
        import("./raid-repository"),
      ]);
      disconnectDatabase = () => prisma.$disconnect();

      const suffix = randomUUID();
      const party = await prisma.party.create({ data: { name: `Override round-trip ${suffix}` } });
      const member = await prisma.partyMember.create({
        data: {
          partyId: party.id,
          nickname: `Member ${suffix}`,
          normalizedNickname: `member ${suffix}`.toLowerCase(),
          className: "Grand Khavatari",
        },
      });

      const input = {
        name: `Duelist composition ${suffix}`,
        slots: [{ memberId: member.id, classOverride: "Duelist" as const }],
      };
      const composition = await compositions.createPartyComposition(party.id, input);
      const savedComposition = await compositions.getPartyComposition(party.id, composition.id);
      expect(savedComposition?.members[0]).toMatchObject({
        memberId: member.id,
        profileId: null,
        classOverride: "Duelist",
      });

      await compositions.updatePartyComposition(party.id, composition.id, input);
      const updatedComposition = await compositions.getPartyComposition(party.id, composition.id);
      expect(updatedComposition?.members[0].classOverride).toBe("Duelist");

      const stage = await prisma.serverStage.create({
        data: {
          code: `OVERRIDE_${suffix}`,
          name: "Override test stage",
          sequence: Date.now() % 1_000_000,
          isSelectable: true,
          publishedAt: new Date(),
        },
      });

      const raidId = await raids.createPartyRaidRecord(party.id, {
        name: "Override snapshot",
        compositionId: composition.id,
        stageId: stage.id,
        stageRevision: stage.revision,
        occurredAt: new Date().toISOString(),
        creationKey: randomUUID(),
        participants: [{ memberId: member.id, status: "PRESENT", classOverride: "Duelist" }],
        lootDrops: [],
      });
      const raid = await prisma.raid.findUniqueOrThrow({
        where: { id: raidId },
        include: { participants: true },
      });

      expect(raid.participants[0]).toMatchObject({
        memberId: member.id,
        classSnapshot: "Duelist",
        profileId: null,
      });
      await prisma.partyMember.update({
        where: { id: member.id },
        data: { className: "Cardinal" },
      });
      expect(
        await prisma.partyMember.findUniqueOrThrow({ where: { id: member.id } }),
      ).toMatchObject({
        className: "Cardinal",
      });
      const historicalRaid = await prisma.raid.findUniqueOrThrow({
        where: { id: raid.id },
        include: { participants: true },
      });
      expect(historicalRaid.participants[0].classSnapshot).toBe("Duelist");
    });
  },
);
