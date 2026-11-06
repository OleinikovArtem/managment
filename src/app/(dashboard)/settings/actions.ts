"use server";

import { revalidatePath } from "next/cache";
import type { PartyActionResult } from "@/features/settings/party-action-result";
import { partySettingsSchema } from "@/features/settings/party-schema";
import { requirePartyActionAccess } from "@/server/auth/party-access";
import { updatePartyName } from "@/server/services/party-service";
import { resetPartyData } from "@/server/repositories/party-repository";
import { RESET_PARTY_CONFIRMATION } from "@/features/settings/reset-confirmation";
import { recordPartyAuditEvent } from "@/server/services/party-audit-service";

export async function updatePartySettingsAction(
  payload: unknown,
): Promise<PartyActionResult> {
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
  await recordPartyAuditEvent(access, { action: "UPDATE", entityType: "party", entityId: partyId, summary: `Переименовал группу в «${parsed.data.name}».` });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true, message: "Настройки группы сохранены." };
}

export async function resetPartyDataAction(payload: unknown): Promise<PartyActionResult> {
  const confirmation = typeof payload === "object" && payload !== null && "confirmation" in payload
    ? payload.confirmation
    : null;
  if (confirmation !== RESET_PARTY_CONFIRMATION) {
    return { ok: false, message: `Введите точно: ${RESET_PARTY_CONFIRMATION}.` };
  }

  const access = await requirePartyActionAccess("OWNER");
  const { partyId } = access;
  try {
    await resetPartyData(partyId);
    await recordPartyAuditEvent(access, { action: "RESET", entityType: "party", entityId: partyId, summary: "Очистил данные группы; общий каталог предметов сохранён." });
  } catch {
    return { ok: false, message: "Не удалось очистить данные. Изменения отменены; проверьте резервную копию и повторите." };
  }
  for (const path of ["/settings", "/dashboard", "/raids", "/sales", "/ledger", "/members"]) {
    revalidatePath(path);
  }
  return { ok: true, message: "Данные группы очищены. Каталог предметов сохранён." };
}
