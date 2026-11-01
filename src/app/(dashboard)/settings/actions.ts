"use server";

import { revalidatePath } from "next/cache";
import type { PartyActionResult } from "@/features/settings/party-action-result";
import { partySettingsSchema } from "@/features/settings/party-schema";
import { ensureLocalWorkspace } from "@/server/bootstrap/local-workspace";
import { updatePartyName } from "@/server/services/party-service";

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
