import "server-only";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { prisma } from "@/lib/db/prisma";

export async function getPartyById(partyId: string) {
  return prisma.party.findUnique({
    where: { id: partyId },
  });
}

export async function renameParty(partyId: string, name: string) {
  return prisma.party.updateMany({
    where: { id: partyId },
    data: { name },
  });
}

export async function getPartyMemberCounts(partyId: string) {
  const [activeMembers, totalMembers] = await Promise.all([
    prisma.partyMember.count({ where: { partyId, isActive: true } }),
    prisma.partyMember.count({ where: { partyId } }),
  ]);

  return { activeMembers, totalMembers };
}

export async function resetPartyData(partyId: string) {
  const constraints = await readFile(resolve(/* turbopackIgnore: true */ process.cwd(), "prisma/financial-constraints.sql"), "utf8");
  const createStart = constraints.search(/^CREATE TRIGGER\b/imu);
  const dropSql = constraints.slice(0, createStart);
  const createSql = constraints.slice(createStart);
  const dropCount = (dropSql.match(/^DROP TRIGGER\b/gimu) ?? []).length;
  const createCount = (createSql.match(/^CREATE TRIGGER\b/gimu) ?? []).length;
  if (createStart < 0 || dropCount === 0 || dropCount !== createCount) {
    throw new Error("Не удалось безопасно подготовить восстановление финансовых ограничений.");
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl?.startsWith("file:")) throw new Error("Не удалось определить файл базы данных для очистки.");
  const databasePath = resolve(/* turbopackIgnore: true */ process.cwd(), decodeURIComponent(databaseUrl.slice("file:".length).split("?")[0] ?? ""));
  const database = new Database(databasePath, { timeout: 5_000 });
  database.pragma("foreign_keys = ON");
  try {
    // Only the explicit, confirmed full reset may remove POSTED rows. SQLite's native
    // transaction keeps trigger DDL and data deletion atomic even if any step fails.
    database.transaction(() => {
      database.exec(dropSql);
      const deletePartyRows = (table: string) => database.prepare(`DELETE FROM "${table}" WHERE partyId = ?`);
      for (const table of [
        "PaymentAllocation",
        "LedgerEntry",
        "LedgerTransaction",
        "MemberPayment",
        "SaleShare",
        "SaleTransaction",
        "LootDrop",
        "RaidParticipant",
        "Raid",
        "PartyCompositionMember",
        "PartyComposition",
        "PartyMemberProfile",
        "PartyMember",
      ]) {
        deletePartyRows(table).run(partyId);
      }
      database.exec(createSql);
    }).immediate();
  } finally {
    database.close();
  }
}
