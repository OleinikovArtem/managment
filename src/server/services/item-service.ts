import "server-only";

import { Prisma } from "@/generated/prisma/client";
import {
  normalizeItemName,
  type ItemInput,
} from "@/features/items/item-schema";
import {
  createPartyItemRecord,
  countPartyItems,
  getPartyItemById,
  listPartyItemCategories,
  listPartyItems,
  updatePartyItemRecord,
} from "@/server/repositories/item-repository";

export class DuplicateItemError extends Error {
  constructor() {
    super("Свой предмет с таким названием уже есть, возможно в архиве.");
    this.name = "DuplicateItemError";
  }
}

export class ItemNotFoundError extends Error {
  constructor() {
    super("Предмет не найден.");
    this.name = "ItemNotFoundError";
  }
}

export const ITEM_PAGE_SIZE = 25;

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

export async function searchItems(
  partyId: string,
  query = "",
  category?: string,
  requestedPage = 1,
) {
  const normalizedQuery = normalizeItemName(query);
  const normalizedCategory = category || undefined;
  const total = await countPartyItems(
    partyId,
    normalizedQuery,
    normalizedCategory,
  );
  const pageCount = Math.max(1, Math.ceil(total / ITEM_PAGE_SIZE));
  const page = Math.min(Math.max(1, requestedPage), pageCount);
  const items = await listPartyItems(
    partyId,
    normalizedQuery,
    normalizedCategory,
    (page - 1) * ITEM_PAGE_SIZE,
    ITEM_PAGE_SIZE,
  );

  return { items, total, page, pageCount };
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
