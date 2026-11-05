"use server";

import { revalidatePath } from "next/cache";
import { ensureLocalWorkspace } from "@/server/bootstrap/local-workspace";
import { createPartyMemberProfile, deletePartyMemberProfile, updatePartyMemberProfile } from "@/server/repositories/member-profile-repository";
import { memberProfileIdSchema, memberProfileInputSchema, memberProfileUpdateSchema } from "@/features/members/member-profile-schema";
import type { MemberProfileActionResult } from "@/features/members/member-profile-action-result";

export async function createMemberProfileAction(payload: unknown): Promise<MemberProfileActionResult> {
  const parsed = memberProfileInputSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: "Проверьте поля профиля.", fieldErrors: parsed.error.flatten().fieldErrors };
  const { partyId } = await ensureLocalWorkspace();
  try {
    await createPartyMemberProfile(partyId, parsed.data);
  } catch (error) {
    if (error instanceof Error) return { ok: false, message: error.message };
    throw error;
  }
  revalidatePath("/members");
  revalidatePath("/compositions");
  revalidatePath("/raids/new");
  return { ok: true, message: "Профиль участника добавлен." };
}

export async function deleteMemberProfileAction(idValue: unknown): Promise<MemberProfileActionResult> {
  const parsed = memberProfileIdSchema.safeParse(idValue);
  if (!parsed.success) return { ok: false, message: "Некорректный профиль." };
  const { partyId } = await ensureLocalWorkspace();
  const result = await deletePartyMemberProfile(partyId, parsed.data);
  if (result.count !== 1) return { ok: false, message: "Профиль не найден." };
  revalidatePath("/members");
  revalidatePath("/compositions");
  revalidatePath("/raids/new");
  return { ok: true, message: "Профиль участника отключён." };
}

export async function updateMemberProfileAction(idValue: unknown, payload: unknown): Promise<MemberProfileActionResult> {
  const id = memberProfileIdSchema.safeParse(idValue);
  const parsed = memberProfileUpdateSchema.safeParse(payload);
  if (!id.success || !parsed.success) return { ok: false, message: "Проверьте поля профиля.", fieldErrors: parsed.success ? undefined : parsed.error.flatten().fieldErrors };
  const { partyId } = await ensureLocalWorkspace();
  const updated = await updatePartyMemberProfile(partyId, id.data, parsed.data);
  if (!updated) return { ok: false, message: "Профиль не найден или уже отключён." };
  revalidatePath("/members");
  revalidatePath("/compositions");
  revalidatePath("/raids/new");
  return { ok: true, message: "Профиль участника обновлён." };
}
