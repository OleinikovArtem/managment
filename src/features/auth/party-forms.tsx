"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  acceptInvitationAction,
  createInvitationAction,
  createPartyAction,
  revokeInvitationAction,
  selectPartyAction,
  type SimpleActionResult,
} from "@/app/account-actions";

type PartyOption = { id: string; name: string; role: string };

function ActionMessage({ result }: { result: SimpleActionResult | null }) {
  if (!result) return null;
  return <p role={result.ok ? "status" : "alert"} className={result.ok ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>{result.message}</p>;
}

export function CreatePartyForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<SimpleActionResult | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = new FormData(event.currentTarget).get("name");
    setPending(true);
    const response = await createPartyAction(name);
    setResult(response);
    setPending(false);
    if (response.ok) {
      router.replace("/dashboard");
      router.refresh();
    }
  }

  return <form onSubmit={submit} className="max-w-lg space-y-4">
    <label className="block space-y-1.5 text-sm font-medium"><span>Название группы</span><Input name="name" minLength={2} maxLength={80} required disabled={pending} autoComplete="organization" /></label>
    <ActionMessage result={result} />
    <Button type="submit" disabled={pending}>{pending ? "Создаём…" : "Создать группу"}</Button>
  </form>;
}

export function PartyPicker({ parties, activePartyId }: { parties: PartyOption[]; activePartyId?: string }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState("");
  const [result, setResult] = useState<SimpleActionResult | null>(null);
  return <div className="max-w-2xl space-y-1">
    {parties.map((party) => <div key={party.id} className="flex min-h-14 items-center justify-between gap-4 border-b border-border py-2">
      <div className="min-w-0"><p className="truncate text-sm font-medium">{party.name}</p><p className="text-xs text-muted-foreground">{party.role === "OWNER" ? "Владелец" : party.role === "MEMBER" ? "Участник" : "Администратор"}</p></div>
      {party.id === activePartyId ? <span className="text-xs text-muted-foreground">Активная</span> : <Button size="sm" variant="outline" disabled={Boolean(pendingId)} onClick={async () => {
        setPendingId(party.id);
        const response = await selectPartyAction(party.id);
        setResult(response);
        setPendingId("");
        if (response.ok) { router.replace("/dashboard"); router.refresh(); }
      }}>{pendingId === party.id ? "Выбираем…" : "Открыть"}</Button>}
    </div>)}
    <ActionMessage result={result} />
  </div>;
}

export function AcceptInvitationButton({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<SimpleActionResult | null>(null);
  return <div className="space-y-3">
    <Button disabled={pending} onClick={async () => {
      setPending(true);
      const response = await acceptInvitationAction(token);
      setResult(response);
      setPending(false);
      if (response.ok) { router.replace("/dashboard"); router.refresh(); }
    }}>{pending ? "Подключаем…" : "Присоединиться"}</Button>
    <ActionMessage result={result} />
  </div>;
}

export function InvitationManager({ invitations }: { invitations: Array<{ id: string; createdAt: string; expiresAt: string; acceptedAt: string | null; revokedAt: string | null; role: string }> }) {
  const [pending, setPending] = useState(false);
  const [invitePath, setInvitePath] = useState("");
  const [result, setResult] = useState<SimpleActionResult | null>(null);
  const [role, setRole] = useState<"MEMBER" | "ADMIN">("MEMBER");

  async function createInvite() {
    setPending(true);
    const response = await createInvitationAction(role);
    setResult(response);
    setInvitePath(response.ok && response.value ? `${window.location.origin}${response.value}` : "");
    setPending(false);
  }

  async function copyInvite() {
    if (!invitePath) return;
    try {
      await navigator.clipboard.writeText(invitePath);
      setResult({ ok: true, message: "Ссылка скопирована. Она действует 7 дней и используется один раз." });
    } catch {
      setResult({ ok: false, message: "Не удалось скопировать. Выделите ссылку и скопируйте её вручную." });
    }
  }

  return <div className="max-w-3xl space-y-6">
    <div className="flex flex-wrap items-center gap-3"><label className="space-y-1 text-xs font-medium">Роль<select aria-label="Роль приглашённого" value={role} disabled={pending} onChange={event => setRole(event.target.value as "MEMBER" | "ADMIN")}><option value="MEMBER">Участник · просмотр</option><option value="ADMIN">Администратор · управление</option></select></label><Button disabled={pending} onClick={createInvite}>{pending ? "Создаём…" : "Создать ссылку"}</Button><span className="text-xs text-muted-foreground">Одноразовая, на 7 дней</span></div>
    {invitePath && <div className="space-y-2 border-l-2 border-chart-1 pl-3">
      <label htmlFor="invite-link" className="text-sm font-medium">Новая ссылка — показывается только сейчас</label>
      <div className="flex gap-2"><Input id="invite-link" readOnly value={invitePath} onFocus={(event) => event.currentTarget.select()} /><Button variant="outline" onClick={copyInvite}>Копировать</Button></div>
    </div>}
    <ActionMessage result={result} />
    {invitations.length > 0 ? <ul className="divide-y divide-border border-y border-border">
      {invitations.map((invite) => {
        const status = invite.acceptedAt ? "Использовано" : invite.revokedAt ? "Отозвано" : new Date(invite.expiresAt) <= new Date() ? "Истекло" : "Ожидает";
        return <li key={invite.id} className="flex items-center justify-between gap-4 py-3">
          <div><p className="text-sm font-medium">{status} · {invite.role === "ADMIN" ? "Администратор" : "Участник"}</p><p className="mt-1 text-xs text-muted-foreground">Создано {invite.createdAt} · истекает {invite.expiresAt}</p></div>
          {status === "Ожидает" && <Button size="sm" variant="outline" disabled={pending} onClick={async () => {
            setPending(true);
            setResult(await revokeInvitationAction(invite.id));
            setPending(false);
          }}>Отозвать</Button>}
        </li>;
      })}
    </ul> : <p className="text-sm text-muted-foreground">Активных приглашений пока нет.</p>}
  </div>;
}

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return <Button variant="ghost" size="sm" disabled={pending} onClick={async () => {
    setPending(true);
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }}>{pending ? "Выходим…" : "Выйти"}</Button>;
}
