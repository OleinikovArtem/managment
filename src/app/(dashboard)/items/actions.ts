"use server";

import { revalidatePath } from "next/cache";
import { itemIdSchema, itemInputSchema } from "@/features/items/item-schema";
import type { ItemActionResult } from "@/features/items/item-action-result";
import { requirePartyActionAccess } from "@/server/auth/party-access";
import { recordPartyAuditEvent } from "@/server/services/party-audit-service";
import { setCustomItemActive } from "@/server/repositories/item-repository";
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

  const access = await requirePartyActionAccess("ADMIN");
  const { partyId } = access;
  try {
    const item = await createItem(partyId, parsed.data);
    await recordPartyAuditEvent(access, {
      action: "CREATE",
      entityType: "item",
      entityId: item.id,
      summary: `Добавил свой предмет «${parsed.data.displayName || parsed.data.canonicalName}».`,
    });
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

  const access = await requirePartyActionAccess("ADMIN");
  const { partyId } = access;
  try {
    await updateItem(partyId, itemId.data, parsed.data);
    await recordPartyAuditEvent(access, {
      action: "UPDATE",
      entityType: "item",
      entityId: itemId.data,
      summary: `Изменил свой предмет «${parsed.data.displayName || parsed.data.canonicalName}».`,
    });
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

export async function archiveItemAction(idValue: unknown, isActive: boolean) {
  const access = await requirePartyActionAccess("ADMIN");
  const id = itemIdSchema.parse(idValue);
  if (typeof isActive !== "boolean" || !(await setCustomItemActive(access.partyId, id, isActive)))
    return { ok: false, message: "Свой предмет не найден." };
  await recordPartyAuditEvent(access, {
    action: "UPDATE",
    entityType: "item",
    entityId: id,
    summary: isActive ? "Восстановил свой предмет." : "Переместил свой предмет в архив.",
  });
  revalidatePath("/items");
  return { ok: true, message: "Сохранено." };
}
