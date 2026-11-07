import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { Client } from "pg";
vi.mock("server-only", () => ({}));
const url = process.env.TEST_DATABASE_URL;
let disconnect: (() => Promise<void>) | undefined;
afterAll(async () => {
  await disconnect?.();
});

describe.skipIf(!url?.startsWith("postgres"))(
  "instance stages and catalog on isolated PostgreSQL",
  () => {
    it("publishes atomically through the administrative operation, audits and replays imports", async () => {
      const require = createRequire(import.meta.url);
      const { applyStageOperation } = require("../../../scripts/manage-server-stages.cjs") as {
        applyStageOperation: (
          db: Client,
          input: Record<string, unknown>,
        ) => Promise<{ stage?: string; revision?: number; replayed?: boolean }>;
      };
      const db = new Client({ connectionString: url });
      await db.connect();
      const previous = (
        await db.query(`SELECT "explicitCurrentStageId" FROM "ServerStageConfig" WHERE id='GLOBAL'`)
      ).rows[0];
      const code = `ADMIN_${randomUUID()}`,
        idempotencyKey = randomUUID(),
        sequence = (Date.now() % 1_000_000) + 5000;
      const operation = {
        key: idempotencyKey,
        actor: "integration-test",
        stage: { code, name: "QA published stage", sequence },
        recommendations: [],
        confirmEmpty: true,
      };
      try {
        const draft = await applyStageOperation(db, operation);
        expect(draft.revision).toBe(1);
        expect(await applyStageOperation(db, operation)).toEqual({ replayed: true });
        await expect(
          applyStageOperation(db, { ...operation, sourceLabel: "different" }),
        ).rejects.toThrow("different contents");
        const published = await applyStageOperation(db, {
          key: randomUUID(),
          actor: "test",
          stage: operation.stage,
          expectedRevision: 1,
          publish: true,
          confirmEmpty: true,
          current: code,
        });
        expect(published.revision).toBe(2);
        expect(
          (
            await db.query('SELECT "isSelectable","publishedAt" FROM "ServerStage" WHERE code=$1', [
              code,
            ])
          ).rows[0],
        ).toMatchObject({ isSelectable: true, publishedAt: expect.any(Date) });
        const before = (await db.query('SELECT revision FROM "ServerStage" WHERE code=$1', [code]))
          .rows[0].revision;
        const failureKey = randomUUID();
        await expect(
          applyStageOperation(db, {
            key: failureKey,
            actor: "test",
            stage: operation.stage,
            expectedRevision: before,
            recommendations: [{ instanceCode: "MISSING", itemId: "MISSING", sortOrder: 0 }],
          }),
        ).rejects.toThrow();
        expect(
          (await db.query('SELECT revision FROM "ServerStage" WHERE code=$1', [code])).rows[0]
            .revision,
        ).toBe(before);
        expect(
          (
            await db.query('SELECT id FROM "ServerStageAuditEvent" WHERE "idempotencyKey"=$1', [
              failureKey,
            ])
          ).rows,
        ).toHaveLength(0);
        await expect(
          applyStageOperation(db, {
            key: randomUUID(),
            actor: "test",
            stage: operation.stage,
            expectedRevision: before,
            isSelectable: false,
          }),
        ).rejects.toThrow();
        await applyStageOperation(db, {
          key: randomUUID(),
          actor: "test",
          stage: operation.stage,
          expectedRevision: before,
          isSelectable: false,
          current: "auto",
        });
        expect(
          (await db.query('SELECT "isSelectable" FROM "ServerStage" WHERE code=$1', [code])).rows[0]
            .isSelectable,
        ).toBe(false);
      } finally {
        await db.query(
          `UPDATE "ServerStageConfig" SET "explicitCurrentStageId"=$1 WHERE id='GLOBAL'`,
          [previous?.explicitCurrentStageId ?? null],
        );
        await db.end();
      }
    }, 45_000);
    it("isolates catalog, inherits defaults, pins draft stages, preserves history and serializes repeated creates", async () => {
      process.env.DATABASE_URL = url;
      const [{ prisma }, catalog, raids, { registerPartySale }, itemRepo] = await Promise.all([
        import("@/lib/db/prisma"),
        import("./instance-repository"),
        import("./raid-repository"),
        import("./sale-repository"),
        import("./item-repository"),
      ]);
      disconnect = () => prisma.$disconnect();
      const prefix = randomUUID();
      const [a, b] = await Promise.all([
        prisma.party.create({ data: { name: `Catalog A ${prefix}` } }),
        prisma.party.create({ data: { name: `Catalog B ${prefix}` } }),
      ]);
      const [member, otherMember] = await Promise.all([
        prisma.partyMember.create({
          data: {
            partyId: a.id,
            nickname: "Korsa",
            normalizedNickname: "korsa",
            className: "Grand Khavatari",
            distributionWeight: 1,
          },
        }),
        prisma.partyMember.create({
          data: {
            partyId: b.id,
            nickname: "Other",
            normalizedNickname: "other",
            distributionWeight: 1,
          },
        }),
      ]);
      const profile = await prisma.partyMemberProfile.create({
        data: {
          partyId: a.id,
          memberId: member.id,
          name: "Subclass 1",
          className: "Cardinal",
          subclassSlot: 1,
        },
      });
      const [s1, s2, draft] = await Promise.all(
        [1, 2, 3].map((sequence) =>
          prisma.serverStage.create({
            data: {
              code: `${prefix}-${sequence}`,
              name: `Stage ${sequence}`,
              sequence: (Date.now() % 1_000_000) + sequence,
              isSelectable: sequence < 3,
              publishedAt: sequence < 3 ? new Date() : null,
            },
          }),
        ),
      );
      const previous = await prisma.serverStageConfig.findUnique({ where: { id: "GLOBAL" } });
      const instance = await prisma.instance.findUniqueOrThrow({ where: { code: "FREYA_HARD" } });
      const [globalItem, ownItem, foreignItem] = await Promise.all([
        prisma.item.create({
          data: { canonicalName: `Global ${prefix}`, normalizedName: `global ${prefix}` },
        }),
        prisma.item.create({
          data: {
            partyId: a.id,
            canonicalName: `Private ${prefix}`,
            normalizedName: `private ${prefix}`,
          },
        }),
        prisma.item.create({
          data: {
            partyId: b.id,
            canonicalName: `Private ${prefix}`,
            normalizedName: `private ${prefix}`,
          },
        }),
      ]);
      try {
        await prisma.serverStageConfig.update({
          where: { id: "GLOBAL" },
          data: { explicitCurrentStageId: s1.id },
        });
        expect((await catalog.getInstanceSetup(a.id)).stages.context.stageId).toBe(s1.id);
        expect((await catalog.getInstanceSetup(b.id)).stages.context.stageId).toBe(s1.id);
        await catalog.saveStageDefault(a.id, s1.id, 0);
        await prisma.serverStageConfig.update({
          where: { id: "GLOBAL" },
          data: { explicitCurrentStageId: s2.id },
        });
        expect((await catalog.getInstanceSetup(a.id)).stages.context.stageId).toBe(s1.id);
        expect((await catalog.getInstanceSetup(b.id)).stages.context.stageId).toBe(s2.id);
        await catalog.saveStageDefault(a.id, null, 1);
        expect((await catalog.getInstanceSetup(a.id)).stages.context.stageId).toBe(s2.id);
        expect(
          (await catalog.getInstanceSetup(a.id)).stages.available.some(
            (row) => row.id === draft.id,
          ),
        ).toBe(false);
        await expect(catalog.saveStageDefault(a.id, draft.id, 2)).rejects.toThrow();
        const custom = await catalog.createCustomInstance(a.id, `Mine ${prefix}`);
        await catalog.saveLootPreset(a.id, custom.id, [globalItem.id, ownItem.id]);
        await expect(catalog.saveLootPreset(b.id, custom.id, [globalItem.id])).rejects.toThrow();
        await expect(catalog.saveLootPreset(a.id, custom.id, [foreignItem.id])).rejects.toThrow();
        await expect(catalog.saveLootPreset(a.id, instance.id, [globalItem.id])).rejects.toThrow();
        await expect(
          prisma.instanceStageLootRecommendation.create({
            data: { instanceId: instance.id, stageId: s1.id, itemId: ownItem.id, sortOrder: 0 },
          }),
        ).rejects.toThrow();
        expect(
          (
            await catalog.getLootRecommendations(a.id, custom.id, {
              stageId: s1.id,
              revision: s1.revision,
            })
          ).items.map((row) => row.id),
        ).toEqual([globalItem.id, ownItem.id]);
        expect(
          (
            await catalog.getLootRecommendations(a.id, custom.id, {
              stageId: s2.id,
              revision: s2.revision,
            })
          ).items.map((row) => row.id),
        ).toEqual([globalItem.id, ownItem.id]);
        expect(
          await prisma.party.findUnique({ where: { id: a.id }, select: { selectedStageId: true } }),
        ).toEqual({ selectedStageId: null });
        const input = {
          name: "",
          instanceId: instance.id,
          stageId: s1.id,
          stageRevision: s1.revision,
          creationKey: randomUUID(),
          occurredAt: "2026-11-06T18:30:00.000Z",
          participants: [
            { memberId: member.id, status: "PRESENT" as const, profileId: profile.id },
          ],
          lootDrops: [{ itemId: ownItem.id, quantity: 2, comment: "Keep" }],
        };
        const ids = await Promise.all([
          raids.createPartyRaidRecord(a.id, input),
          raids.createPartyRaidRecord(a.id, input),
        ]);
        expect(ids[0]).toBe(ids[1]);
        expect(
          await prisma.raid.count({ where: { partyId: a.id, creationKey: input.creationKey } }),
        ).toBe(1);
        let raid = await prisma.raid.findUniqueOrThrow({
          where: { id: ids[0] },
          include: { lootDrops: true, participants: true },
        });
        expect(raid).toMatchObject({
          name: instance.displayName,
          stageId: s1.id,
          stageNameSnapshot: s1.name,
        });
        expect(raid.participants[0]).toMatchObject({
          classSnapshot: "Cardinal",
          profileId: profile.id,
        });
        // Saved request is replayed before checking a now stale stage revision.
        await prisma.serverStage.update({
          where: { id: s1.id },
          data: { revision: { increment: 1 }, isSelectable: false },
        });
        expect(await raids.createPartyRaidRecord(a.id, input)).toBe(raid.id);
        await expect(
          raids.createPartyRaidRecord(a.id, { ...input, creationKey: randomUUID() }),
        ).rejects.toThrow();
        await expect(
          raids.createPartyRaidRecord(a.id, { ...input, name: "different" }),
        ).rejects.toThrow();
        await expect(
          raids.createPartyRaidRecord(a.id, {
            ...input,
            creationKey: randomUUID(),
            stageId: s2.id,
            stageRevision: s2.revision,
            lootDrops: [{ itemId: foreignItem.id, quantity: 1 }],
          }),
        ).rejects.toThrow();
        await expect(
          raids.createPartyRaidRecord(b.id, {
            ...input,
            creationKey: randomUUID(),
            instanceId: custom.id,
            stageId: s2.id,
            stageRevision: s2.revision,
            participants: [{ memberId: otherMember.id, status: "PRESENT" }],
            lootDrops: [],
          }),
        ).rejects.toThrow();
        const drop = raid.lootDrops[0];
        expect(
          await itemRepo.updatePartyItemRecord(
            a.id,
            globalItem.id,
            { canonicalName: "Forbidden" },
            "forbidden",
            globalItem.grade,
          ),
        ).toBeNull();
        expect(await itemRepo.setCustomItemActive(b.id, ownItem.id, false)).toBe(false);
        expect(await itemRepo.setCustomItemActive(a.id, ownItem.id, false)).toBe(true);
        await prisma.partyMemberProfile.update({
          where: { id: profile.id },
          data: { isActive: false },
        });
        await raids.updatePartyRaidRecord(a.id, raid.id, {
          ...input,
          lootDrops: [{ id: drop.id, itemId: ownItem.id, quantity: 2, comment: "Still kept" }],
        });
        await expect(
          raids.updatePartyRaidRecord(a.id, raid.id, {
            ...input,
            lootDrops: [
              { id: drop.id, itemId: ownItem.id, quantity: 2 },
              { itemId: ownItem.id, quantity: 1 },
            ],
          }),
        ).rejects.toThrow("архиве");
        expect(await itemRepo.setCustomItemActive(a.id, ownItem.id, true)).toBe(true);
        raid = await prisma.raid.findUniqueOrThrow({
          where: { id: raid.id },
          include: { lootDrops: true, participants: true },
        });
        expect(raid.stageId).toBe(s1.id);
        expect(raid.stageRevisionSnapshot).toBe(s1.revision);
        expect(raid.lootDrops[0].id).toBe(drop.id);
        expect(raid.participants[0].classSnapshot).toBe("Cardinal");
        await expect(
          prisma.raid.update({ where: { id: raid.id }, data: { stageId: s2.id } }),
        ).rejects.toThrow();
        const saleInput = {
          lootDropId: drop.id,
          quantitySold: 1,
          totalPrice: 101n,
          receivedAt: new Date(),
          idempotencyKey: randomUUID(),
        };
        const race = await Promise.allSettled([
          registerPartySale(a.id, saleInput),
          raids.updatePartyRaidRecord(a.id, raid.id, {
            ...input,
            lootDrops: [{ id: drop.id, itemId: ownItem.id, quantity: 2 }],
          }),
        ]);
        expect(race[0].status).toBe("fulfilled");
        expect(await prisma.saleShare.findFirst({ where: { partyId: a.id } })).toMatchObject({
          amount: 101n,
          weightSnapshot: 1,
        });
        await expect(raids.updatePartyRaidRecord(a.id, raid.id, input)).rejects.toThrow("продажа");
        expect(await prisma.raid.count({ where: { partyId: a.id } })).toBe(1);
        await catalog.saveLootPreset(a.id, custom.id, []);
        expect(
          (
            await catalog.getLootRecommendations(a.id, custom.id, {
              stageId: s2.id,
              revision: s2.revision,
            })
          ).items,
        ).toEqual([]);
        await catalog.updateCustomInstance(a.id, custom.id, { isActive: false });
        await catalog.updateCustomInstance(a.id, custom.id, { isActive: true });
        await prisma.serverStageConfig.update({
          where: { id: "GLOBAL" },
          data: { explicitCurrentStageId: null },
        });
        const maximum = await prisma.serverStage.findFirstOrThrow({
          where: { isSelectable: true, publishedAt: { not: null } },
          orderBy: { sequence: "desc" },
        });
        expect((await catalog.getInstanceSetup(a.id)).stages.context.stageId).toBe(maximum.id);
      } finally {
        await prisma.serverStageConfig.update({
          where: { id: "GLOBAL" },
          data: { explicitCurrentStageId: previous?.explicitCurrentStageId ?? null },
        });
      }
    }, 90_000);
  },
);
