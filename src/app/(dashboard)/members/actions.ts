"use server";

import { revalidatePath } from "next/cache";
import { memberIdSchema, memberInputSchema } from "@/features/members/member-schema";
import type { MemberActionResult } from "@/features/members/member-action-result";
import { requirePartyActionAccess } from "@/server/auth/party-access";
import { recordPartyAuditEvent } from "@/server/services/party-audit-service";
import { MemberClassesError } from "@/features/members/member-class-errors";
import {
  createPartyMember,
  deactivatePartyMember,
  DuplicateNicknameError,
  PartyMemberNotFoundError,
  updatePartyMember,
} from "@/server/services/party-member-service";

export async function createMemberAction(payload: unknown): Promise<MemberActionResult> {
  const parsed = memberInputSchema.safeParse(payload);
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
    await createPartyMember(partyId, parsed.data);
    await recordPartyAuditEvent(access, {
      action: "CREATE",
      entityType: "member",
      summary: `Добавил участника «${parsed.data.nickname}».`,
    });
  } catch (error) {
    if (error instanceof MemberClassesError) return { ok: false, message: error.message };
    if (error instanceof DuplicateNicknameError) {
      return {
        ok: false,
        message: "Участник с таким ником уже существует.",
        fieldErrors: { nickname: [error.message] },
      };
    }
    throw error;
  }

  revalidatePath("/members");
  revalidatePath("/dashboard");
  revalidatePath("/compositions");
  revalidatePath("/raids/new");
  return { ok: true, message: "Участник добавлен." };
}

export async function updateMemberAction(
  memberIdValue: unknown,
  payload: unknown,
): Promise<MemberActionResult> {
  const memberId = memberIdSchema.safeParse(memberIdValue);
  const parsed = memberInputSchema.safeParse(payload);
  if (!memberId.success || !parsed.success) {
    return {
      ok: false,
      message: "Проверьте выделенные поля.",
      fieldErrors: parsed.success ? undefined : parsed.error.flatten().fieldErrors,
    };
  }

  const access = await requirePartyActionAccess("ADMIN");
  const { partyId } = access;
  try {
    await updatePartyMember(partyId, memberId.data, parsed.data);
    await recordPartyAuditEvent(access, {
      action: "UPDATE",
      entityType: "member",
      entityId: memberId.data,
      summary: `Изменил данные участника «${parsed.data.nickname}».`,
    });
  } catch (error) {
    if (error instanceof MemberClassesError) return { ok: false, message: error.message };
    if (error instanceof DuplicateNicknameError) {
      return {
        ok: false,
        message: "Участник с таким ником уже существует.",
        fieldErrors: { nickname: [error.message] },
      };
    }
    if (error instanceof PartyMemberNotFoundError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }

  revalidatePath("/members");
  revalidatePath("/compositions");
  revalidatePath("/raids/new");
  return { ok: true, message: "Данные участника обновлены." };
}

export async function deactivateMemberAction(memberIdValue: unknown): Promise<MemberActionResult> {
  const memberId = memberIdSchema.safeParse(memberIdValue);
  if (!memberId.success) {
    return { ok: false, message: "Некорректный идентификатор участника." };
  }

  const access = await requirePartyActionAccess("ADMIN");
  const { partyId } = access;
  try {
    await deactivatePartyMember(partyId, memberId.data);
    await recordPartyAuditEvent(access, {
      action: "DEACTIVATE",
      entityType: "member",
      entityId: memberId.data,
      summary: "Деактивировал участника.",
    });
  } catch (error) {
    if (error instanceof PartyMemberNotFoundError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }

  revalidatePath("/members");
  revalidatePath("/dashboard");
  return { ok: true, message: "Участник деактивирован." };
}
