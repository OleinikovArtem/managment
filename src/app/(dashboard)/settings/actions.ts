"use server";

import { revalidatePath } from "next/cache";
import type { PartyActionResult } from "@/features/settings/party-action-result";
import { partySettingsSchema } from "@/features/settings/party-schema";
import { requirePartyActionAccess } from "@/server/auth/party-access";
import { updatePartyName } from "@/server/services/party-service";
import { resetPartyData } from "@/server/repositories/party-repository";
import { resetRequestSchema, RESET_OPTIONS } from "@/features/settings/reset-plan";
import { recordPartyAuditEvent } from "@/server/services/party-audit-service";

export async function updatePartySettingsAction(payload: unknown): Promise<PartyActionResult> {
  const parsed = partySettingsSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Проверьте название группы.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const access = await requirePartyActionAccess("ADMIN");
  const { partyId } = access;
  await updatePartyName(partyId, parsed.data.name);
  await recordPartyAuditEvent(access, {
    action: "UPDATE",
    entityType: "party",
    entityId: partyId,
    summary: `Переименовал группу в «${parsed.data.name}».`,
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true, message: "Настройки группы сохранены." };
}

export async function resetPartyDataAction(payload: unknown): Promise<PartyActionResult> {
  const access = await requirePartyActionAccess("OWNER");
  const parsed = resetRequestSchema.safeParse(payload);
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Проверьте выбор данных." };
  const { partyId } = access;
  try {
    const categories = await resetPartyData(partyId, parsed.data.categories);
    const labels = RESET_OPTIONS.filter((option) => categories.includes(option.id))
      .map((option) => option.label)
      .join(", ");
    await recordPartyAuditEvent(access, {
      action: "RESET",
      entityType: "party",
      entityId: partyId,
      summary: `Сбросил данные: ${labels}. Общий каталог предметов сохранён.`,
    });
  } catch {
    return {
      ok: false,
      message:
        "Не удалось очистить данные. Изменения отменены; проверьте резервную копию и повторите.",
    };
  }
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: "Выбранные данные и их зависимости сброшены. Общий каталог сохранён.",
  };
}
