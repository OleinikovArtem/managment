import "server-only";

import { Prisma } from "@/generated/prisma/client";
import {
  normalizeItemName,
  type ItemInput,
} from "@/features/items/item-schema";
import {
  createPartyItemRecord,
  getPartyItemById,
  listPartyItemCategories,
  listPartyItems,
  updatePartyItemRecord,
} from "@/server/repositories/item-repository";

export class DuplicateItemError extends Error {
  constructor() {
    super("Предмет с таким названием уже есть в каталоге этой группы.");
    this.name = "DuplicateItemError";
  }
}

export class ItemNotFoundError extends Error {
  constructor() {
    super("Предмет не найден.");
    this.name = "ItemNotFoundError";
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

export async function searchItems(
  partyId: string,
  query = "",
  category?: string,
) {
  const normalizedQuery = normalizeItemName(query);
  return listPartyItems(partyId, normalizedQuery, category || undefined);
}

export async function getItemCategories(partyId: string) {
  return listPartyItemCategories(partyId);
}

export async function getItem(partyId: string, itemId: string) {
  const item = await getPartyItemById(partyId, itemId);
  if (!item) {
    throw new ItemNotFoundError();
  }
  return item;
}

export async function createItem(partyId: string, input: ItemInput) {
  const normalizedName = normalizeItemName(input.canonicalName);
  if (!normalizedName) {
    throw new Error("Название не может состоять только из пробелов.");
  }

  try {
    return await createPartyItemRecord(partyId, input, normalizedName);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new DuplicateItemError();
    }
    throw error;
  }
}

export async function updateItem(
  partyId: string,
  itemId: string,
  input: ItemInput,
) {
  const normalizedName = normalizeItemName(input.canonicalName);
  if (!normalizedName) {
    throw new Error("Название не может состоять только из пробелов.");
  }

  try {
    const item = await updatePartyItemRecord(
      partyId,
      itemId,
      input,
      normalizedName,
    );
    if (!item) {
      throw new ItemNotFoundError();
    }
    return item;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new DuplicateItemError();
    }
    throw error;
  }
}
