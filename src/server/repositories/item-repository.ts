import "server-only";

import { prisma } from "@/lib/db/prisma";
import type { ItemInput } from "@/features/items/item-schema";

export async function listPartyItems(
  partyId: string,
  normalizedQuery: string,
  category: string | undefined,
) {
  return prisma.item.findMany({
    where: {
      partyId,
      ...(normalizedQuery ? { normalizedName: { contains: normalizedQuery } } : {}),
      ...(category ? { category } : {}),
    },
    orderBy: [{ normalizedName: "asc" }, { canonicalName: "asc" }],
  });
}

export async function listPartyItemCategories(partyId: string) {
  const rows = await prisma.item.findMany({
    where: { partyId, category: { not: null } },
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });
  return rows.flatMap((row) => (row.category ? [row.category] : []));
}

export async function getPartyItemById(partyId: string, itemId: string) {
  return prisma.item.findFirst({
    where: { id: itemId, partyId },
  });
}

export async function createPartyItemRecord(
  partyId: string,
  input: ItemInput,
  normalizedName: string,
) {
  return prisma.item.create({
    data: {
      partyId,
      canonicalName: input.canonicalName,
      normalizedName,
      displayName: input.displayName || null,
      category: input.category || null,
      gameVersion: input.gameVersion || null,
      comment: input.comment || null,
    },
  });
}

export async function updatePartyItemRecord(
  partyId: string,
  itemId: string,
  input: ItemInput,
  normalizedName: string,
) {
  const result = await prisma.item.updateMany({
    where: { id: itemId, partyId },
    data: {
      canonicalName: input.canonicalName,
      normalizedName,
      displayName: input.displayName || null,
      category: input.category || null,
      gameVersion: input.gameVersion || null,
      comment: input.comment || null,
    },
  });

  if (result.count !== 1) {
    return null;
  }

  return getPartyItemById(partyId, itemId);
}
