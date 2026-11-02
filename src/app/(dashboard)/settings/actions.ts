"use server";

import { revalidatePath } from "next/cache";
import type { PartyActionResult } from "@/features/settings/party-action-result";
import { partySettingsSchema } from "@/features/settings/party-schema";
import { ensureLocalWorkspace } from "@/server/bootstrap/local-workspace";
import { updatePartyName } from "@/server/services/party-service";
import { resetPartyData } from "@/server/repositories/party-repository";
import { RESET_PARTY_CONFIRMATION } from "@/features/settings/reset-confirmation";

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

  const { partyId } = await ensureLocalWorkspace();
  await updatePartyName(partyId, parsed.data.name);

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

  const { partyId } = await ensureLocalWorkspace();
  await resetPartyData(partyId);
  for (const path of ["/settings", "/dashboard", "/raids", "/sales", "/ledger", "/members"]) {
    revalidatePath(path);
  }
  return { ok: true, message: "Данные группы очищены. Каталог предметов сохранён." };
}
