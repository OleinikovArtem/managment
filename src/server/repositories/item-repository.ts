import "server-only";

import { prisma } from "@/lib/db/prisma";
import type { ItemInput } from "@/features/items/item-schema";
import { selectableCatalog, visibleCatalog } from "./catalog-scope";
import { lockParty } from "./catalog-locks";

export async function listPartyItems(
  partyId: string,
  normalizedQuery: string,
  category: string | undefined,
  skip: number,
  take: number,
) {
  return prisma.item.findMany({
    where: {
      ...visibleCatalog(partyId),
      ...(normalizedQuery ? { normalizedName: { contains: normalizedQuery } } : {}),
      ...(category ? { category } : {}),
    },
    orderBy: [{ normalizedName: "asc" }, { canonicalName: "asc" }],
    skip,
    take,
  });
}

export async function countPartyItems(
  partyId: string,
  normalizedQuery: string,
  category: string | undefined,
) {
  return prisma.item.count({
    where: {
      ...visibleCatalog(partyId),
      ...(normalizedQuery ? { normalizedName: { contains: normalizedQuery } } : {}),
      ...(category ? { category } : {}),
    },
  });
}

export async function listPartyItemCategories(partyId: string) {
  const rows = await prisma.item.findMany({
    where: { ...visibleCatalog(partyId), category: { not: null } },
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });
  return rows.flatMap((row) => (row.category ? [row.category] : []));
}

export async function getPartyItemById(partyId: string, itemId: string) {
  return prisma.item.findFirst({
    where: { id: itemId, ...visibleCatalog(partyId) },
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

  return getPartyItemById(partyId, itemId);
}

export async function setCustomItemActive(partyId: string, id: string, isActive: boolean) {
  return prisma.$transaction(async tx => {
    await lockParty(tx, partyId);
    const changed = await tx.item.updateMany({ where: { id, partyId }, data: { isActive } });
    return changed.count === 1;
  });
}

export function searchSelectableItems(partyId: string, query: string) {
  return prisma.item.findMany({ where: { AND: [selectableCatalog(partyId), ...(query ? [{ OR: [{ normalizedName: { contains: query } }, { displayName: { contains: query, mode: "insensitive" as const } }] }] : [])] }, take: 40, orderBy: [{ normalizedName: "asc" }, { id: "asc" }], select: { id: true, canonicalName: true, displayName: true, category: true, partyId: true, isActive: true } });
}
