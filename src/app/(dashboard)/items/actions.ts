"use server";

import { revalidatePath } from "next/cache";
import { itemIdSchema, itemInputSchema } from "@/features/items/item-schema";
import type { ItemActionResult } from "@/features/items/item-action-result";
import { ensureLocalWorkspace } from "@/server/bootstrap/local-workspace";
import {
  createItem,
  DuplicateItemError,
  ItemNotFoundError,
  updateItem,
} from "@/server/services/item-service";

export async function createItemAction(payload: unknown): Promise<ItemActionResult> {
  const parsed = itemInputSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Проверьте выделенные поля.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { partyId } = await ensureLocalWorkspace();
  try {
    const item = await createItem(partyId, parsed.data);
    revalidatePath("/items");
    revalidatePath("/dashboard");
    return {
      ok: true,
      message: "Предмет добавлен в каталог.",
      itemId: item.id,
    };
  } catch (error) {
    if (error instanceof DuplicateItemError) {
      return {
        ok: false,
        message: error.message,
        fieldErrors: { canonicalName: [error.message] },
      };
    }
    throw error;
  }
}

export async function updateItemAction(
  itemIdValue: unknown,
  payload: unknown,
): Promise<ItemActionResult> {
  const itemId = itemIdSchema.safeParse(itemIdValue);
  const parsed = itemInputSchema.safeParse(payload);
  if (!itemId.success || !parsed.success) {
    return {
      ok: false,
      message: "Проверьте выделенные поля.",
      fieldErrors: parsed.success ? undefined : parsed.error.flatten().fieldErrors,
    };
  }

  const { partyId } = await ensureLocalWorkspace();
  try {
    await updateItem(partyId, itemId.data, parsed.data);
  } catch (error) {
    if (error instanceof DuplicateItemError) {
      return {
        ok: false,
        message: error.message,
        fieldErrors: { canonicalName: [error.message] },
      };
    }
    if (error instanceof ItemNotFoundError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }

  revalidatePath("/items");
  revalidatePath(`/items/${itemId.data}`);
  return { ok: true, message: "Предмет обновлён." };
}
