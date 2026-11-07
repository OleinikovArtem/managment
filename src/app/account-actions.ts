"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PartyRole } from "@/generated/prisma/enums";
import { recordPartyAuditEvent } from "@/server/services/party-audit-service";
import {
  acceptPartyInvitation,
  assertUserBelongsToParty,
  createPartyForUser,
  createPartyInvitation,
  changePartyMemberRole,
  InvitationUnavailableError,
  revokePartyInvitation,
  removePartyMember,
} from "@/server/services/account-party-service";
import {
  requirePartyActionAccess,
  requireSignedInActionUser,
  setActivePartyCookie,
} from "@/server/auth/party-access";

const partyNameSchema = z.string().trim().min(2, "Введите название группы.").max(80, "Название не должно быть длиннее 80 символов.");
const idSchema = z.string().min(1).max(100);
const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{40,50}$/);
const invitationRoleSchema = z.enum(["ADMIN", "MEMBER"]);
const memberRoleSchema = z.enum(["ADMIN", "MEMBER"]);

export type SimpleActionResult = { ok: true; message: string; value?: string } | { ok: false; message: string };

export async function createPartyAction(value: unknown): Promise<SimpleActionResult> {
  const user = await requireSignedInActionUser();
  const parsed = partyNameSchema.safeParse(value);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Проверьте название группы." };
  const party = await createPartyForUser(user.id, parsed.data);
  await setActivePartyCookie(party.id);
  revalidatePath("/");
  return { ok: true, message: "Группа создана.", value: party.id };
}

export async function selectPartyAction(value: unknown): Promise<SimpleActionResult> {
  const user = await requireSignedInActionUser();
  const parsed = idSchema.safeParse(value);
  if (!parsed.success || !(await assertUserBelongsToParty(user.id, parsed.data))) {
    return { ok: false, message: "Группа недоступна для этого аккаунта." };
  }
  await setActivePartyCookie(parsed.data);
  revalidatePath("/");
  return { ok: true, message: "Активная группа изменена.", value: parsed.data };
}

export async function acceptInvitationAction(value: unknown): Promise<SimpleActionResult> {
  const user = await requireSignedInActionUser();
  const parsed = tokenSchema.safeParse(value);
  if (!parsed.success) return { ok: false, message: "Ссылка приглашения недействительна." };
  try {
    const partyId = await acceptPartyInvitation(parsed.data, user.id);
    await setActivePartyCookie(partyId);
    revalidatePath("/");
    return { ok: true, message: "Вы присоединились к группе.", value: partyId };
  } catch (error) {
    if (!(error instanceof InvitationUnavailableError)) throw error;
    return { ok: false, message: "Ссылка приглашения недействительна, использована или истекла." };
  }
}

export async function createInvitationAction(roleValue: unknown): Promise<SimpleActionResult> {
  const access = await requirePartyActionAccess("ADMIN");
  const parsedRole = invitationRoleSchema.safeParse(roleValue);
  if (!parsedRole.success) return { ok: false, message: "Выберите роль приглашённого." };
  const role = parsedRole.data === "ADMIN" ? PartyRole.ADMIN : PartyRole.MEMBER;
  const invitation = await createPartyInvitation(access.partyId, access.userId, role);
  await recordPartyAuditEvent(access, { action: "CREATE", entityType: "invitation", entityId: invitation.id, summary: `Создал одноразовое приглашение: ${parsedRole.data === "ADMIN" ? "администратор" : "участник"}.` });
  return {
    ok: true,
    message: `Создана одноразовая ссылка для роли ${parsedRole.data === "ADMIN" ? "администратора" : "участника"} на 7 дней.`,
    value: `/invite/${invitation.token}`,
  };
}

export async function revokeInvitationAction(value: unknown): Promise<SimpleActionResult> {
  const access = await requirePartyActionAccess("ADMIN");
  const parsed = idSchema.safeParse(value);
  if (!parsed.success || !(await revokePartyInvitation(access.partyId, parsed.data))) {
    return { ok: false, message: "Ссылку нельзя отозвать: она уже использована, отозвана или не найдена." };
  }
  await recordPartyAuditEvent(access, { action: "REVOKE", entityType: "invitation", entityId: parsed.data, summary: "Отозвал приглашение в группу." });
  revalidatePath("/settings/access");
  return { ok: true, message: "Приглашение отозвано." };
}

export async function updatePartyMemberRoleAction(membershipValue: unknown, roleValue: unknown): Promise<SimpleActionResult> {
  const access = await requirePartyActionAccess("OWNER");
  const membershipId = idSchema.safeParse(membershipValue);
  const role = memberRoleSchema.safeParse(roleValue);
  if (!membershipId.success || !role.success) return { ok: false, message: "Проверьте участника и выбранную роль." };
  const updated = await changePartyMemberRole(access.partyId, membershipId.data, role.data === "ADMIN" ? PartyRole.ADMIN : PartyRole.MEMBER);
  if (!updated) return { ok: false, message: "Роль не изменена: участник не найден или является владельцем группы." };
  await recordPartyAuditEvent(access, { action: "UPDATE_ROLE", entityType: "membership", entityId: membershipId.data, summary: `Изменил роль участника на ${role.data === "ADMIN" ? "администратора" : "участника"}.` });
  revalidatePath("/settings/access");
  revalidatePath("/");
  return { ok: true, message: "Роль участника изменена." };
}

export async function removePartyMemberAction(value: unknown): Promise<SimpleActionResult> {
  const access = await requirePartyActionAccess("OWNER");
  const membershipId = idSchema.safeParse(value);
  if (!membershipId.success) return { ok: false, message: "Участник не найден." };
  const removed = await removePartyMember(access.partyId, membershipId.data);
  if (!removed) return { ok: false, message: "Доступ не отозван: участник не найден или является владельцем группы." };
  await recordPartyAuditEvent(access, { action: "REMOVE", entityType: "membership", entityId: membershipId.data, summary: "Отозвал доступ участника к группе." });
  revalidatePath("/settings/access");
  revalidatePath("/");
  return { ok: true, message: "Доступ участника отозван. История группы сохранена." };
}
