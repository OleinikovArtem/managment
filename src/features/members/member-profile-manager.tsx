"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createMemberProfileAction, deleteMemberProfileAction, updateMemberProfileAction } from "@/app/(dashboard)/members/profile-actions";
import { LINEAGE2_HIGH_FIVE_CLASSES } from "@/features/members/lineage2-classes";
import { GameIcon } from "@/components/ui/game-icon";

export type MemberProfileRow = { id: string; name: string; className: string; role: string | null; level: number | null; note: string | null };

export function MemberProfileManager({ memberId, profiles }: { memberId: string; profiles: MemberProfileRow[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MemberProfileRow | null>(null);
  const [pending, startTransition] = useTransition();

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await createMemberProfileAction({ memberId, name: data.get("name"), className: data.get("className"), role: data.get("role"), level: data.get("level") === "" ? null : Number(data.get("level")), note: data.get("note") });
      if (!result.ok) { toast.error(result.message); return; }
      toast.success(result.message); event.currentTarget.reset(); setOpen(false);
    });
  }

  function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateMemberProfileAction(editing.id, { name: data.get("name"), className: data.get("className"), role: data.get("role"), level: data.get("level") === "" ? null : Number(data.get("level")), note: data.get("note") });
      if (!result.ok) { toast.error(result.message); return; }
      toast.success(result.message); setEditing(null);
    });
  }

  return <div className="mt-3 border-t border-border/60 pt-3">
    <div className="flex items-center justify-between gap-2"><p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Профили · {profiles.length}</p><Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setOpen((value) => !value)}><Plus aria-hidden="true" size={14} />{open ? "Скрыть" : "Добавить профу"}</Button></div>
    {profiles.length > 0 && <div className="mt-2 grid gap-2 sm:grid-cols-2">{profiles.map((profile) => <div key={profile.id} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2"><button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setEditing(profile)}><GameIcon kind="class" name={profile.className} size="sm" /><span className="min-w-0"><p className="truncate text-xs font-medium">{profile.name} <span className="font-normal text-muted-foreground">· {profile.className}</span></p><p className="truncate text-[11px] text-muted-foreground">{[profile.role, profile.level ? `Lv. ${profile.level}` : null, profile.note].filter(Boolean).join(" · ") || "Без заметки"}</p></span></button><div className="flex shrink-0 items-center gap-1"><Button type="button" variant="ghost" size="icon-sm" className="size-7 text-muted-foreground" aria-label={`Редактировать профиль ${profile.name}`} disabled={pending} onClick={() => setEditing(profile)}><Pencil aria-hidden="true" size={14} /></Button><Button type="button" variant="ghost" size="icon-sm" className="size-7 text-muted-foreground hover:text-destructive" aria-label={`Отключить профиль ${profile.name}`} disabled={pending} onClick={() => startTransition(async () => { const result = await deleteMemberProfileAction(profile.id); if (!result.ok) toast.error(result.message); else toast.success(result.message); })}><Trash2 aria-hidden="true" size={14} /></Button></div></div>)}</div>}
    {open && <form className="mt-2 grid gap-2 rounded-lg border border-primary/20 bg-primary/5 p-2.5 sm:grid-cols-2" onSubmit={save}><label className="space-y-1 text-[11px] font-medium">Название профиля<Input name="name" required placeholder="Основной SE" /></label><label className="space-y-1 text-[11px] font-medium">3-я профа<select name="className" required defaultValue="" className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"><option value="" disabled>Выберите класс</option>{LINEAGE2_HIGH_FIVE_CLASSES.map((className) => <option key={className} value={className}>{className}</option>)}</select></label><label className="space-y-1 text-[11px] font-medium">Роль<Input name="role" placeholder="Healer / Buffer" /></label><label className="space-y-1 text-[11px] font-medium">Уровень<Input name="level" type="number" min={1} max={99} placeholder="85" /></label><label className="space-y-1 text-[11px] font-medium sm:col-span-2">Заметка<Input name="note" placeholder="Для mage-пати" /></label><div className="flex gap-2 sm:col-span-2"><Button type="submit" size="sm" disabled={pending}>{pending ? "Сохраняем…" : "Сохранить профу"}</Button><Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}><X aria-hidden="true" />Отмена</Button></div></form>}
    {editing && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}><div role="dialog" aria-modal="true" aria-labelledby={`profile-edit-${editing.id}`} className="w-full max-w-lg rounded-xl border border-border bg-card p-4 shadow-2xl"><div className="mb-4 flex items-start justify-between gap-3"><div><h2 id={`profile-edit-${editing.id}`} className="font-semibold">Редактировать профиль</h2><p className="mt-1 text-xs text-muted-foreground">Изменения будут доступны в будущих составах и рейдах.</p></div><Button type="button" variant="ghost" size="icon-sm" aria-label="Закрыть окно" onClick={() => setEditing(null)}><X aria-hidden="true" /></Button></div><form className="grid gap-3 sm:grid-cols-2" onSubmit={saveEdit}><label className="space-y-1 text-xs font-medium">Название профиля<Input name="name" required defaultValue={editing.name} /></label><label className="space-y-1 text-xs font-medium">3-я профа<select name="className" required defaultValue={editing.className} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm">{LINEAGE2_HIGH_FIVE_CLASSES.map((className) => <option key={className} value={className}>{className}</option>)}</select></label><label className="space-y-1 text-xs font-medium">Роль<Input name="role" defaultValue={editing.role ?? ""} /></label><label className="space-y-1 text-xs font-medium">Уровень<Input name="level" type="number" min={1} max={99} defaultValue={editing.level ?? ""} /></label><label className="space-y-1 text-xs font-medium sm:col-span-2">Заметка<Input name="note" defaultValue={editing.note ?? ""} /></label><div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="ghost" onClick={() => setEditing(null)}>Отмена</Button><Button type="submit" disabled={pending}>{pending ? "Сохраняем…" : "Сохранить"}</Button></div></form></div></div>}
  </div>;
}
