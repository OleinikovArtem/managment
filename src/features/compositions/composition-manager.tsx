"use client";

import { useState, useTransition } from "react";
import { Layers3, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createCompositionAction, deleteCompositionAction } from "@/app/(dashboard)/members/composition-actions";
import { GameIcon } from "@/components/ui/game-icon";

export type CompositionProfile = { id: string; name: string; className: string; role: string | null; level: number | null };
export type CompositionMember = { id: string; nickname: string; className: string | null; role: string | null; level: number | null; profiles: CompositionProfile[] };
export type CompositionRow = { id: string; name: string; description: string | null; focus: string | null; members: { member: CompositionMember; profile: CompositionProfile | null }[] };
type Props = { compositions: CompositionRow[]; members: CompositionMember[] };

export function CompositionManager({ compositions, members }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<{ memberId: string; profileId?: string }[]>([]);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await createCompositionAction({ name: data.get("name"), description: data.get("description"), focus: data.get("focus"), slots: selected });
      if (!result.ok) { setMessage(result.message); toast.error(result.message); return; }
      toast.success(result.message); setMessage(null); setSelected([]); setOpen(false); event.currentTarget.reset();
    });
  }

  function remove(id: string, name: string) {
    if (!window.confirm(`Удалить профиль «${name}»? Исторические рейды сохранятся.`)) return;
    startTransition(async () => { const result = await deleteCompositionAction(id); if (!result.ok) toast.error(result.message); else toast.success(result.message); });
  }

  return <section className="space-y-3">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold">Профили состава</h2><p className="text-sm text-muted-foreground">Сохранённые сетки для рейдов: основной, mage, melee, осада или замена.</p></div><Button size="sm" onClick={() => setOpen((value) => !value)} aria-expanded={open}><Plus aria-hidden="true" />{open ? "Скрыть" : "Новый профиль"}</Button></div>
    {open && <Card size="sm" className="border-primary/30"><CardHeader className="flex-row items-start justify-between"><div><CardTitle>Новый состав</CardTitle><CardDescription>Можно выбрать больше 9 участников. Для обычной партии рекомендуется до 9.</CardDescription></div><Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)} aria-label="Закрыть форму"><X aria-hidden="true" /></Button></CardHeader><CardContent><form className="space-y-4" onSubmit={save}><div className="grid gap-3 sm:grid-cols-3"><label className="space-y-1.5 text-xs font-medium">Название<Input name="name" required placeholder="Основной рейд" /></label><label className="space-y-1.5 text-xs font-medium">Тип состава<Input name="focus" placeholder="Melee / Mage / Archer" /></label><label className="space-y-1.5 text-xs font-medium sm:col-span-1">Описание<Input name="description" placeholder="Короткая заметка" /></label></div><div><p className="mb-2 text-xs font-medium text-muted-foreground">Сетка · {selected.length} участников <span className="font-normal">(рекомендация: до 9)</span></p><div className="overflow-hidden rounded-lg border border-border/70"><div className="grid grid-cols-[minmax(0,1fr)_minmax(150px,0.8fr)_auto] gap-2 border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"><span>Участник</span><span>Профиль</span><span>В составе</span></div>{members.map((member) => { const slot = selected.find((item) => item.memberId === member.id); const checked = Boolean(slot); return <div key={member.id} className="grid grid-cols-[minmax(0,1fr)_minmax(150px,0.8fr)_auto] items-center gap-2 border-b border-border/50 px-3 py-2 last:border-0"><div className="min-w-0"><p className="truncate text-sm">{member.nickname}</p><p className="truncate text-[11px] text-muted-foreground">{member.role || member.className || "Профиль не заполнен"}</p></div><select className="h-8 min-w-0 rounded-md border border-input bg-background px-2 text-xs" value={slot?.profileId ?? ""} disabled={!checked || pending} onChange={(event) => setSelected((current) => current.map((item) => item.memberId === member.id ? { ...item, profileId: event.target.value || undefined } : item))}><option value="">{member.profiles.length ? "Базовый профиль" : "Профа не задана"}</option>{member.profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name} · {profile.className}</option>)}</select><input type="checkbox" checked={checked} disabled={pending || (!checked && selected.length >= 36)} aria-label={`Добавить ${member.nickname} в состав`} onChange={() => setSelected((current) => checked ? current.filter((item) => item.memberId !== member.id) : [...current, { memberId: member.id }])} /></div>})}</div></div>{message && <p role="alert" className="text-sm text-destructive">{message}</p>}<Button type="submit" disabled={pending || selected.length === 0}><Layers3 aria-hidden="true" />{pending ? "Сохраняем…" : "Сохранить профиль"}</Button></form></CardContent></Card>}
    {compositions.length === 0 ? <div className="rounded-xl border border-dashed border-border px-5 py-6 text-sm text-muted-foreground">Профилей пока нет. Создайте первый состав, чтобы подставлять сетку в новый рейд.</div> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{compositions.map((composition) => <Card size="sm" key={composition.id}><CardHeader className="flex-row items-start justify-between gap-3"><div className="min-w-0"><CardTitle className="truncate">{composition.name}</CardTitle><CardDescription className="mt-1">{composition.focus || "Общий состав"} · {composition.members.length} участников{composition.members.length <= 9 ? " · рекомендовано" : " · расширенный"}</CardDescription></div><Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" onClick={() => remove(composition.id, composition.name)} aria-label={`Удалить профиль ${composition.name}`} disabled={pending}><Trash2 aria-hidden="true" /></Button></CardHeader><CardContent><div className="space-y-1.5">{composition.members.map(({ member, profile }) => <div key={member.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/30 px-2 py-1.5 text-xs"><span className="flex min-w-0 items-center gap-2 truncate"><GameIcon kind="class" name={profile?.className || member.className || "Support"} size="sm" /><span className="truncate">{member.nickname}</span></span><span className="truncate text-muted-foreground">{profile ? `${profile.name} · ${profile.className}` : member.className || "Профа не выбрана"}</span></div>)}</div>{composition.description && <p className="mt-3 text-xs text-muted-foreground">{composition.description}</p>}</CardContent></Card>)}</div>}
  </section>;
}
