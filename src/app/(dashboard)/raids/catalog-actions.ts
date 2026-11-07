"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePartyActionAccess } from "@/server/auth/party-access";
import { recordPartyAuditEvent } from "@/server/services/party-audit-service";
import {
  CatalogOperationError,
  catalogId,
  instanceNameSchema,
  stageContextSchema,
} from "@/features/instances/catalog-schema";
import {
  createCustomInstance,
  getInstanceSetup,
  getLootRecommendations,
  saveLootPreset,
  saveStageDefault,
  updateCustomInstance,
} from "@/server/repositories/instance-repository";
import { searchSelectableItems } from "@/server/repositories/item-repository";
import { normalizeItemName } from "@/features/items/item-schema";

export async function loadRaidCatalogAction(instanceId: string | null, context: unknown) {
  const { partyId } = await requirePartyActionAccess("ADMIN");
  const parsed = stageContextSchema.safeParse(context);
  if (!parsed.success || (instanceId !== null && !catalogId.safeParse(instanceId).success))
    return { ok: false as const, message: "Некорректный выбор." };
  try {
    return {
      ok: true as const,
      data: await getLootRecommendations(partyId, instanceId, parsed.data),
    };
  } catch (error) {
    if (error instanceof CatalogOperationError)
      return { ok: false as const, message: error.message };
    throw error;
  }
}
export async function loadRaidSetupAction() {
  const { partyId } = await requirePartyActionAccess("ADMIN");
  return getInstanceSetup(partyId);
}
export async function searchRaidItemsAction(query: string) {
  const { partyId } = await requirePartyActionAccess("ADMIN");
  return searchSelectableItems(partyId, normalizeItemName(z.string().max(200).parse(query)));
}
export async function createInstanceAction(nameValue: unknown) {
  const access = await requirePartyActionAccess("ADMIN");
  const parsed = instanceNameSchema.safeParse(nameValue);
  if (!parsed.success) return { ok: false as const, message: "Введите название до 120 символов." };
  try {
    const row = await createCustomInstance(access.partyId, parsed.data);
    await recordPartyAuditEvent(access, {
      action: "CREATE",
      entityType: "instance",
      entityId: row.id,
      summary: `Добавил свой инстанс «${row.displayName}».`,
    });
    return {
      ok: true as const,
      instance: {
        id: row.id,
        name: row.name,
        displayName: row.displayName,
        aliases: row.aliases,
        source: row.source,
        partyId: row.partyId,
        isActive: row.isActive,
      },
    };
  } catch (error) {
    if (error instanceof CatalogOperationError)
      return { ok: false as const, message: error.message };
    throw error;
  }
}
export async function manageInstanceAction(id: string, input: unknown) {
  const access = await requirePartyActionAccess("ADMIN");
  const parsed = z
    .object({ name: instanceNameSchema.optional(), isActive: z.boolean().optional() })
    .strict()
    .safeParse(input);
  if (!catalogId.safeParse(id).success || !parsed.success)
    return { ok: false, message: "Проверьте название." };
  try {
    await updateCustomInstance(access.partyId, id, parsed.data);
    await recordPartyAuditEvent(access, {
      action: "UPDATE",
      entityType: "instance",
      entityId: id,
      summary: "Изменил свой инстанс.",
    });
    return { ok: true, message: "Сохранено." };
  } catch (error) {
    if (error instanceof CatalogOperationError) return { ok: false, message: error.message };
    return { ok: false, message: "Название занято или инстанс изменился." };
  }
}
export async function saveLootPresetAction(instanceId: string | null, values: unknown) {
  const access = await requirePartyActionAccess("ADMIN");
  const ids = z
    .array(catalogId)
    .max(200)
    .refine((rows) => new Set(rows).size === rows.length)
    .safeParse(values);
  if (!ids.success || (instanceId !== null && !catalogId.safeParse(instanceId).success))
    return { ok: false, message: "Некорректный набор." };
  try {
    await saveLootPreset(access.partyId, instanceId, ids.data);
    await recordPartyAuditEvent(access, {
      action: "UPDATE",
      entityType: "loot-preset",
      entityId: instanceId ?? undefined,
      summary: instanceId
        ? "Изменил рекомендации своего инстанса."
        : "Изменил быстрый дроп группы.",
    });
    return { ok: true, message: "Набор сохранён." };
  } catch (error) {
    if (error instanceof CatalogOperationError) return { ok: false, message: error.message };
    throw error;
  }
}
export async function savePartyStageAction(stageId: string | null, revision: number) {
  const access = await requirePartyActionAccess("ADMIN");
  if (
    !z.number().int().nonnegative().safeParse(revision).success ||
    (stageId !== null && !catalogId.safeParse(stageId).success)
  )
    return { ok: false, message: "Некорректная стадия." };
  try {
    const next = await saveStageDefault(access.partyId, stageId, revision);
    await recordPartyAuditEvent(access, {
      action: "UPDATE",
      entityType: "party-stage",
      summary: stageId
        ? "Изменил стадию по умолчанию для новых рейдов."
        : "Включил автоматическую стадию новых рейдов.",
    });
    revalidatePath("/settings");
    return {
      ok: true,
      revision: next,
      message: "Настройка сохранена. Открытые черновики не изменятся.",
    };
  } catch (error) {
    if (error instanceof CatalogOperationError) return { ok: false, message: error.message };
    throw error;
  }
}
