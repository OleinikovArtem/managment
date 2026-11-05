import { randomUUID } from "node:crypto";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { afterAll, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const testPath = path.resolve(`prisma/resale-integration-${process.pid}.db`);
const previousUrl = process.env.DATABASE_URL;
let disconnect: (() => Promise<void>) | undefined;

afterAll(async () => {
  await disconnect?.();
  if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl;
  for (const suffix of ["", "-wal", "-shm"]) if (existsSync(testPath + suffix)) rmSync(testPath + suffix);
});

it("preserves legacy weight snapshots while posting equal partial sales and retries", async () => {
  const source = new Database(path.resolve("prisma/dev.db"), { readonly: true });
  await source.backup(testPath);
  source.close();
  process.env.DATABASE_URL = `file:./prisma/${path.basename(testPath)}`;
  vi.resetModules();
  const { prisma } = await import("@/lib/db/prisma");
  disconnect = () => prisma.$disconnect();
  const { registerPartySale } = await import("@/server/repositories/sale-repository");
  const partyId = `resale-party-${randomUUID()}`;
  await prisma.party.create({ data: { id: partyId, name: "Resale regression" } });
  const item = await prisma.item.create({ data: { partyId, canonicalName: "Resale fixture", normalizedName: "resale fixture" } });
  const raid = await prisma.raid.create({ data: { partyId, name: "Historical weighted roster", occurredAt: new Date("2026-10-01T10:00:00Z") } });
  const weights = [2, 1, 4];
  for (const [index, weight] of weights.entries()) {
    const member = await prisma.partyMember.create({ data: { partyId, nickname: `Member ${index}`, normalizedNickname: `member ${index}`, distributionWeight: 1 } });
    await prisma.raidParticipant.create({ data: { id: `resale-${index}-${randomUUID()}`, partyId, raidId: raid.id, memberId: member.id, nicknameSnapshot: member.nickname, status: "PRESENT", distributionWeight: weight } });
  }
  const drop = await prisma.lootDrop.create({ data: { partyId, raidId: raid.id, itemId: item.id, quantity: 2 } });
  const first = await registerPartySale(partyId, { lootDropId: drop.id, quantitySold: 1, totalPrice: 9n, receivedAt: new Date("2026-11-01T10:00:00Z"), idempotencyKey: randomUUID() });
  expect(first.shares.map(share => share.amount)).toEqual([3n, 3n, 3n]);
  const request = { lootDropId: drop.id, quantitySold: 1, totalPrice: 10n, receivedAt: new Date("2026-11-02T10:00:00Z"), idempotencyKey: randomUUID() };
  const second = await registerPartySale(partyId, request);
  expect(second.shares.map(share => share.amount).sort()).toEqual([3n, 3n, 4n]);
  expect(second.shares.reduce((sum, share) => sum + share.amount, 0n)).toBe(10n);
  const participants = await prisma.raidParticipant.findMany({ where: { partyId, raidId: raid.id }, orderBy: { id: "asc" } });
  expect(participants.map(participant => participant.distributionWeight)).toEqual(weights);
  for (const share of second.shares) expect(share.weightSnapshot).toBe(participants.find(p => p.id === share.raidParticipantId)?.distributionWeight);
  expect((await registerPartySale(partyId, request)).id).toBe(second.id);
  expect((await prisma.raid.findUniqueOrThrow({ where: { id: raid.id } })).lockedAt).not.toBeNull();
  await expect(registerPartySale(partyId, { ...request, idempotencyKey: randomUUID() })).rejects.toThrow("оставшееся количество");
  expect(await prisma.saleTransaction.count({ where: { partyId } })).toBe(2);
  const entries = await prisma.ledgerEntry.findMany({ where: { partyId, ledgerTransaction: { status: "POSTED" } } });
  expect(entries.reduce((sum, entry) => sum + entry.debit - entry.credit, 0n)).toBe(0n);
});
