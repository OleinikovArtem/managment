import { Suspense } from "react";
import { io } from "next/cache";
import { redirect } from "next/navigation";
import { InvitationManager, PartyMemberAccessManager } from "@/features/auth/party-forms";
import { requirePartyPageAccess } from "@/server/auth/party-access";
import { listPartyInvitations, listPartyMembers } from "@/server/services/account-party-service";

export default function PartyAccessPage() {
  return <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">Загружаем доступ…</p>}><PartyAccessContent /></Suspense>;
}

async function PartyAccessContent() {
  await io();
  const access = await requirePartyPageAccess();
  if (!access.canManage) redirect("/dashboard");
  const invitations = await listPartyInvitations(access.partyId);
  const members = await listPartyMembers(access.partyId);

  return <div className="space-y-6">
    <header className="page-header"><h1>Доступ к группе</h1><p className="mt-2">Управляйте доступом участников и создавайте одноразовые ссылки с ролью администратора или участника.</p></header>
    {access.isOwner && <section><h2 className="mb-4 text-base font-semibold">Участники группы</h2><PartyMemberAccessManager members={members.map(member => ({ id: member.id, displayName: member.user.displayName, username: member.user.username, role: member.role, joinedAt: member.createdAt.toLocaleDateString("ru-RU") }))} /></section>}
    <section><h2 className="mb-4 text-base font-semibold">Приглашения</h2><InvitationManager invitations={invitations.map(({ id, createdAt, expiresAt, acceptedAt, revokedAt, role }) => ({ id, createdAt: createdAt.toLocaleString("ru-RU"), expiresAt: expiresAt.toLocaleString("ru-RU"), acceptedAt: acceptedAt?.toISOString() ?? null, revokedAt: revokedAt?.toISOString() ?? null, role }))} /></section>
    <section className="max-w-2xl border-t border-border pt-5"><h2 className="text-sm font-semibold">Восстановление доступа</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Аккаунты используют только логин и пароль. Писем и сброса пароля нет, администратор не может заменить пароль участнику. Если пароль потерян, аккаунт пока нельзя восстановить; заранее сохраните его в надёжном месте.</p></section>
  </div>;
}
