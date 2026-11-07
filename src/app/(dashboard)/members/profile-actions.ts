"use server";

import { revalidatePath } from "next/cache";
import { requirePartyActionAccess } from "@/server/auth/party-access";
import { recordPartyAuditEvent } from "@/server/services/party-audit-service";
import {
  createPartyMemberProfile,
  deletePartyMemberProfile,
  updatePartyMemberProfile,
} from "@/server/repositories/member-profile-repository";
import {
  memberProfileIdSchema,
  memberProfileInputSchema,
  memberProfileUpdateSchema,
} from "@/features/members/member-profile-schema";
import type { MemberProfileActionResult } from "@/features/members/member-profile-action-result";

export async function createMemberProfileAction(
  payload: unknown,
): Promise<MemberProfileActionResult> {
  const parsed = memberProfileInputSchema.safeParse(payload);
  if (!parsed.success)
    return {
      ok: false,
      message: "Проверьте поля профиля.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  const access = await requirePartyActionAccess("ADMIN");
  const { partyId } = access;
  try {
    await createPartyMemberProfile(partyId, parsed.data);
    await recordPartyAuditEvent(access, {
      action: "CREATE",
      entityType: "member-profile",
      summary: "Добавил игровой профиль участника.",
    });
  } catch (error) {
    if (error instanceof Error) return { ok: false, message: error.message };
    throw error;
  }
  revalidatePath("/members");
  revalidatePath("/compositions");
  revalidatePath("/raids/new");
  return { ok: true, message: "Профиль участника добавлен." };
}

export async function deleteMemberProfileAction(
  idValue: unknown,
): Promise<MemberProfileActionResult> {
  const parsed = memberProfileIdSchema.safeParse(idValue);
  if (!parsed.success) return { ok: false, message: "Некорректный профиль." };
  const access = await requirePartyActionAccess("ADMIN");
  const { partyId } = access;
  const result = await deletePartyMemberProfile(partyId, parsed.data);
  if (result.count !== 1) return { ok: false, message: "Профиль не найден." };
  await recordPartyAuditEvent(access, {
    action: "DEACTIVATE",
    entityType: "member-profile",
    entityId: parsed.data,
    summary: "Отключил игровой профиль.",
  });
  revalidatePath("/members");
  revalidatePath("/compositions");
  revalidatePath("/raids/new");
  return { ok: true, message: "Профиль участника отключён." };
}

export async function updateMemberProfileAction(
  idValue: unknown,
  payload: unknown,
): Promise<MemberProfileActionResult> {
  const id = memberProfileIdSchema.safeParse(idValue);
  const parsed = memberProfileUpdateSchema.safeParse(payload);
  if (!id.success || !parsed.success)
    return {
      ok: false,
      message: "Проверьте поля профиля.",
      fieldErrors: parsed.success ? undefined : parsed.error.flatten().fieldErrors,
    };
  const access = await requirePartyActionAccess("ADMIN");
  const { partyId } = access;
  let updated: Awaited<ReturnType<typeof updatePartyMemberProfile>>;
  try {
    updated = await updatePartyMemberProfile(partyId, id.data, parsed.data);
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Не удалось обновить профиль. Проверьте данные и повторите.",
    };
  }
  if (updated.status === "not-found")
    return { ok: false, message: "Профиль не найден или уже отключён." };
  if (updated.status === "stale")
    return {
      ok: false,
      message: "Профиль изменился в другой вкладке. Закройте форму и загрузите актуальные данные.",
    };
  await recordPartyAuditEvent(access, {
    action: "UPDATE",
    entityType: "member-profile",
    entityId: id.data,
    summary: `Изменил игровой профиль «${parsed.data.name}».`,
  });
  revalidatePath("/members");
  revalidatePath("/compositions");
  revalidatePath("/raids/new");
  return { ok: true, message: "Профиль участника обновлён." };
}
