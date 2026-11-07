import "server-only";
import { prisma } from "@/lib/db/prisma";

type LootRecord = {
  id: string;
  itemId: string;
  canonicalName: string;
  displayName: string | null;
  category: string | null;
  raidId: string;
  raidName: string;
  occurredAt: Date;
  createdAt: Date;
  quantity: number;
  sold: number;
  proceeds: string;
  sales: { quantitySold: number; totalPrice: string; receivedAt: string }[];
};

export async function listPartyLoot(partyId: string) {
  const rows = await prisma.$queryRaw<LootRecord[]>`
    SELECT l.id, l."itemId", i."canonicalName", i."displayName", i.category,
      r.id AS "raidId", r.name AS "raidName", r."occurredAt", l."createdAt", l.quantity,
      COALESCE(SUM(s."quantitySold"), 0)::integer AS sold,
      COALESCE(SUM(s."totalPrice"), 0)::text AS proceeds,
      COALESCE(
        json_agg(json_build_object(
          'quantitySold', s."quantitySold",
          'totalPrice', s."totalPrice"::text,
          'receivedAt', s."receivedAt"
        ) ORDER BY s."receivedAt", s."createdAt") FILTER (WHERE s.id IS NOT NULL),
        '[]'::json
      ) AS sales
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
