import "server-only";
import { prisma } from "@/lib/db/prisma";

type LootRecord = {
  id: string;
  itemId: string;
  canonicalName: string;
  displayName: string | null;
  raidId: string;
  raidName: string;
  occurredAt: Date;
  createdAt: Date;
  quantity: number;
  sold: number;
  proceeds: string;
};

export async function listPartyLoot(partyId: string) {
  const rows = await prisma.$queryRaw<LootRecord[]>`
    SELECT l.id, l."itemId", i."canonicalName", i."displayName",
      r.id AS "raidId", r.name AS "raidName", r."occurredAt", l."createdAt", l.quantity,
      COALESCE(SUM(s."quantitySold"), 0)::integer AS sold,
      COALESCE(SUM(s."totalPrice"), 0)::text AS proceeds
    FROM "LootDrop" l
    JOIN "Raid" r ON r.id = l."raidId" AND r."partyId" = l."partyId"
    JOIN "Item" i ON i.id = l."itemId"
    LEFT JOIN "SaleTransaction" s ON s."lootDropId" = l.id AND s."partyId" = l."partyId"
    WHERE l."partyId" = ${partyId}
    GROUP BY l.id, r.id, i.id
    ORDER BY l."createdAt" DESC, l.id DESC
  `;
  return rows.map((row) => ({
    ...row,
    name: row.displayName || row.canonicalName,
    remaining: row.quantity - row.sold,
    status:
      row.sold === 0
        ? ("unsold" as const)
        : row.sold < row.quantity
          ? ("partial" as const)
          : ("sold" as const),
    occurredAt: row.occurredAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }));
}

export type LootRow = Awaited<ReturnType<typeof listPartyLoot>>[number];
