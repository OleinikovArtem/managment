"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ActionMenu } from "@/components/ui/action-menu";
import { EditorDialog } from "@/components/ui/editor-dialog";
import { GameIcon } from "@/components/ui/game-icon";
import { createMemberProfileAction, deleteMemberProfileAction, updateMemberProfileAction } from "@/app/(dashboard)/members/profile-actions";
import { LINEAGE2_HIGH_FIVE_CLASSES } from "@/features/members/lineage2-classes";

export type MemberProfileRow = { id: string; name: string; className: string; role: string | null; level: number | null; note: string | null; subclassSlot: number | null };

function ProfileFields({ profile }: { profile?: MemberProfileRow }) {
  return <div className="grid gap-4 sm:grid-cols-2">
    <label className="space-y-2 text-sm">Название профиля<Input name="name" required maxLength={80} defaultValue={profile?.name} placeholder="Основной профиль" /></label>
    <label className="space-y-2 text-sm">Класс<select name="className" required defaultValue={profile?.className ?? ""} className="w-full"><option value="" disabled>Выберите класс</option>{LINEAGE2_HIGH_FIVE_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}</select></label>
    <label className="space-y-2 text-sm">Роль<Input name="role" defaultValue={profile?.role ?? ""} placeholder="Healer, Buffer, DPS" /></label>
    <label className="space-y-2 text-sm sm:col-span-2">Заметка<Input name="note" defaultValue={profile?.note ?? ""} /></label>
  </div>;
}

export function MemberProfileManager({ memberId, profiles, canManage }: { memberId: string; profiles: MemberProfileRow[]; canManage: boolean }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<MemberProfileRow | null>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const data = new FormData(element);
    const values = { name: data.get("name"), className: data.get("className"), role: data.get("role"), note: data.get("note") };
    setMessage(null);
    startTransition(async () => {
      const result = editing ? await updateMemberProfileAction(editing.id, values) : await createMemberProfileAction({ ...values, memberId });
      if (!result.ok) { setMessage(result.message); toast.error(result.message); return; }
      toast.success(result.message); element.reset(); setCreating(false); setEditing(null); router.refresh();
    });
  }
  return <div>
    <div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-sm font-medium">Игровые профили</h3>{canManage && <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => { setCreating(true); setMessage(null); }}>Добавить профиль</Button>}</div>
    {profiles.length === 0 ? <p className="text-sm text-muted-foreground">Можно добавить альтернативные классы для разных составов.</p> : <ul className="divide-y divide-border">{profiles.map(profile => <li key={profile.id} className="flex items-center gap-3 py-3">
      <GameIcon kind="class" name={profile.className} size="sm" />
      <div className="min-w-0 flex-1"><p className="text-sm font-medium">{profile.name} · {profile.className}</p><p className="mt-1 text-xs text-muted-foreground">{[profile.role, profile.note].filter(Boolean).join(" · ")}</p></div>
      {canManage && <ActionMenu label={`Действия профиля ${profile.name}`} disabled={pending} items={[{ label: "Изменить профиль", onClick: () => { setEditing(profile); setMessage(null); } }, { label: "Отключить профиль", destructive: true, onClick: () => { if (!window.confirm(`Отключить профиль «${profile.name}»? История рейдов сохранится.`)) return; startTransition(async () => { const result = await deleteMemberProfileAction(profile.id); if (result.ok) { toast.success(result.message); router.refresh(); } else toast.error(result.message); }); } }]} />}
    </li>)}</ul>}

    {canManage && <EditorDialog open={creating || Boolean(editing)} onClose={() => { if (!pending) { setCreating(false); setEditing(null); } }} title={editing ? "Изменить профиль" : "Новый профиль"} description="Изменения используются в будущих составах. История рейдов сохраняется.">
      <form key={editing?.id ?? "new"} onSubmit={save} className="space-y-5"><ProfileFields profile={editing ?? undefined} />{message && <p role="alert" className="text-sm text-destructive">{message}</p>}<div className="flex gap-2"><Button disabled={pending} type="submit">{pending ? "Сохранение…" : "Сохранить"}</Button><Button type="button" variant="ghost" disabled={pending} onClick={() => { setCreating(false); setEditing(null); }}>Отмена</Button></div></form>
    </EditorDialog>}
  </div>;
}
