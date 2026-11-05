"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ActionMenu } from "@/components/ui/action-menu";
import { GameIcon } from "@/components/ui/game-icon";
import { createCompositionAction, deleteCompositionAction } from "@/app/(dashboard)/members/composition-actions";

export type CompositionProfile = { id: string; name: string; className: string; role: string | null; level: number | null };
export type CompositionMember = { id: string; nickname: string; className: string | null; role: string | null; level: number | null; profiles: CompositionProfile[] };
export type CompositionRow = { id: string; name: string; description: string | null; focus: string | null; members: { member: CompositionMember; profile: CompositionProfile | null }[] };

export function CompositionManager({ compositions, members }: { compositions: CompositionRow[]; members: CompositionMember[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState(compositions[0]?.id ?? "");
  const [selected, setSelected] = useState<{ memberId: string; profileId?: string }[]>([]);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const active = compositions.find(item => item.id === activeId) ?? compositions[0];
  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const data = new FormData(element);
    setMessage(null);
    startTransition(async () => {
      const result = await createCompositionAction({ name: data.get("name"), description: data.get("description"), focus: data.get("focus"), slots: selected });
      if (!result.ok) { setMessage(result.message); toast.error(result.message); return; }
      toast.success(result.message); element.reset(); setSelected([]); setOpen(false); router.refresh();
    });
  }
  function remove(item: CompositionRow) {
    if (!window.confirm(`Удалить состав «${item.name}»? Исторические рейды сохранятся.`)) return;
    startTransition(async () => { const result = await deleteCompositionAction(item.id); if (result.ok) { toast.success(result.message); router.refresh(); } else toast.error(result.message); });
  }

  return <section>
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Сохранённых составов: {compositions.length}</p>{!open && <Button onClick={() => setOpen(true)}>Новый состав</Button>}</div>
    {open ? <form onSubmit={save} className="editor-surface space-y-6">
      <h2 className="section-heading">Новый состав</h2>
      <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-2 text-sm">Название<Input name="name" required placeholder="Основной рейд" /></label><label className="space-y-2 text-sm">Направление<Input name="focus" placeholder="Melee, Mage, Archer" /></label><label className="space-y-2 text-sm sm:col-span-2">Описание<Input name="description" placeholder="Необязательная заметка" /></label></div>
      <div><h3 className="text-sm font-medium">Выбрано {selected.length} из 36</h3><p className="mt-1 mb-3 text-xs text-muted-foreground">Для обычной партии рекомендуется до 9 участников.</p>
        {members.length === 0 ? <p className="empty-state">Сначала <Link href="/members" className="underline">добавьте участников</Link>.</p> : members.map(member => {
          const slot = selected.find(item => item.memberId === member.id);
          const checked = Boolean(slot);
          return <div key={member.id} className="slot-row"><div className="min-w-0"><p className="text-sm font-medium break-words">{member.nickname}</p><p className="mt-1 text-xs text-muted-foreground">{member.className || member.role || "Класс не указан"}</p></div><select aria-label={`Профиль ${member.nickname}`} className="min-w-0 w-full" disabled={!checked || pending} value={slot?.profileId ?? ""} onChange={e => setSelected(current => current.map(item => item.memberId === member.id ? { ...item, profileId: e.target.value || undefined } : item))}><option value="">Базовый профиль</option>{member.profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name} · {profile.className}</option>)}</select><input type="checkbox" checked={checked} disabled={pending || (!checked && selected.length >= 36)} aria-label={`Добавить ${member.nickname} в состав`} onChange={() => setSelected(current => checked ? current.filter(item => item.memberId !== member.id) : [...current, { memberId: member.id }])} /></div>;
        })}
      </div>
      {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
      <div className="flex gap-2"><Button type="submit" disabled={pending || selected.length === 0}>{pending ? "Сохранение…" : "Сохранить состав"}</Button><Button type="button" variant="ghost" disabled={pending} onClick={() => { if (selected.length && !window.confirm("Отменить создание состава? Выбранные участники не сохранятся.")) return; setOpen(false); setSelected([]); }}>Отмена</Button></div>
    </form> : !active ? <p className="empty-state">Создайте состав, чтобы одним выбором подставлять участников и профили в новый рейд.</p> : <div className="composition-layout">
      <nav aria-label="Сохранённые составы" className="space-y-1">{compositions.map(item => <button type="button" key={item.id} aria-current={active.id === item.id ? "true" : undefined} className="composition-choice" onClick={() => setActiveId(item.id)}><span className="block text-sm font-medium">{item.name}</span><span className="mt-1 block text-xs text-muted-foreground">{item.focus || "Общий состав"} · участников: {item.members.length}</span></button>)}</nav>
      <section className="min-w-0"><div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="section-heading">{active.name}</h2><p className="mt-1 text-sm text-muted-foreground">{active.focus || "Общий состав"} · {active.members.length} участников</p></div><ActionMenu label={`Действия состава ${active.name}`} disabled={pending} items={[{ label: "Удалить состав", destructive: true, onClick: () => remove(active) }]} /></div>
        <ul className="composition-roster">{active.members.map(({ member, profile }) => <li key={member.id}><GameIcon kind="class" name={profile?.className || member.className || "Support"} size="sm" /><div className="min-w-0"><p className="text-sm font-medium break-words">{member.nickname}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{profile ? `${profile.name} · ${profile.className}` : member.className || "Базовый профиль"}</p></div></li>)}</ul>
        {active.description && <p className="mt-5 whitespace-pre-wrap text-sm text-muted-foreground">{active.description}</p>}
      </section>
    </div>}
  </section>;
}
