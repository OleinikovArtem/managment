import "server-only";

import { prisma } from "@/lib/db/prisma";
import type { ItemInput } from "@/features/items/item-schema";

export async function listPartyItems(
  _partyId: string,
  normalizedQuery: string,
  category: string | undefined,
  skip: number,
  take: number,
) {
  return prisma.item.findMany({
    where: {
      ...(normalizedQuery ? { normalizedName: { contains: normalizedQuery } } : {}),
      ...(category ? { category } : {}),
    },
    orderBy: [{ normalizedName: "asc" }, { canonicalName: "asc" }],
    skip,
    take,
  });
}

export async function countPartyItems(
  _partyId: string,
  normalizedQuery: string,
  category: string | undefined,
) {
  return prisma.item.count({
    where: {
      ...(normalizedQuery ? { normalizedName: { contains: normalizedQuery } } : {}),
      ...(category ? { category } : {}),
    },
  });
}

export async function listPartyItemCategories(_partyId: string) {
  void _partyId;
  const rows = await prisma.item.findMany({
    where: { category: { not: null } },
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });
  return rows.flatMap((row) => (row.category ? [row.category] : []));
}

export async function getPartyItemById(_partyId: string, itemId: string) {
  return prisma.item.findFirst({
    where: { id: itemId },
  });
}

export async function createPartyItemRecord(
  _partyId: string,
  input: ItemInput,
  normalizedName: string,
) {
  return prisma.item.create({
    data: {
      canonicalName: input.canonicalName,
      normalizedName,
      displayName: input.displayName || null,
      category: input.category || null,
      grade: input.grade || null,
      itemType: input.itemType || null,
      itemSubtype: input.itemSubtype || null,
      isRare: input.isRare ?? false,
      gameVersion: input.gameVersion || null,
      comment: input.comment || null,
    },
  });
}

export async function updatePartyItemRecord(
  _partyId: string,
  itemId: string,
  input: ItemInput,
  normalizedName: string,
) {
  const result = await prisma.item.updateMany({
    where: { id: itemId },
    data: {
      canonicalName: input.canonicalName,
      normalizedName,
      displayName: input.displayName || null,
      category: input.category || null,
      grade: input.grade || null,
      itemType: input.itemType || null,
      itemSubtype: input.itemSubtype || null,
      isRare: input.isRare ?? false,
      gameVersion: input.gameVersion || null,
      comment: input.comment || null,
    },
  });

  if (result.count !== 1) {
    return null;
  }

  return getPartyItemById(_partyId, itemId);
}
