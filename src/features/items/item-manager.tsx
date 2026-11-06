"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ActionMenu } from "@/components/ui/action-menu";
import { GameIcon } from "@/components/ui/game-icon";
import { ItemForm } from "@/features/items/item-form";
import type { ItemInput } from "@/features/items/item-schema";
import { createItemAction, updateItemAction } from "@/app/(dashboard)/items/actions";

export type ItemListRow = ItemInput & { id: string; createdAt: string };

export function ItemManager({ items, summary, canManage }: { items: ItemListRow[]; summary: string; canManage: boolean }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  function created(id?: string) { setCreating(false); router.refresh(); if (id) router.push(`/items/${id}`); }
  function updated() { setEditingId(null); router.refresh(); }
  return <section>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground" aria-live="polite">{summary}</p>{canManage && !creating && <Button variant="outline" size="sm" onClick={() => { setCreating(true); setEditingId(null); }}>Добавить предмет</Button>}</div>
    {canManage && creating && <div className="editor-surface mb-6"><h2 className="section-heading mb-4">Новый предмет</h2><ItemForm submitLabel="Добавить в каталог" action={createItemAction} onSuccess={created} onCancel={() => setCreating(false)} /></div>}
    {items.length === 0 ? <p className="empty-state">Предметы не найдены. Измените поиск или добавьте новый предмет.</p> : <ul className="data-list">{items.map(item => <li key={item.id}>
      {editingId === item.id ? <div className="editor-surface"><h2 className="section-heading mb-4">Изменить предмет</h2><ItemForm initialValues={{ canonicalName: item.canonicalName, displayName: item.displayName ?? "", category: item.category ?? "", grade: item.grade ?? "", itemType: item.itemType ?? "", itemSubtype: item.itemSubtype ?? "", isRare: item.isRare, gameVersion: item.gameVersion ?? "", comment: item.comment ?? "" }} submitLabel="Сохранить" action={values => updateItemAction(item.id, values)} onSuccess={updated} onCancel={() => setEditingId(null)} /></div> : <div className="flex items-center gap-3">
        <GameIcon kind="item" name={item.displayName || item.canonicalName} category={item.category} />
        <div className="min-w-0 flex-1"><Link href={`/items/${item.id}`} className="text-sm font-medium hover:underline underline-offset-4 break-words">{item.displayName || item.canonicalName}</Link>{item.displayName && item.displayName !== item.canonicalName && <p className="mt-1 text-xs text-muted-foreground">{item.canonicalName}</p>}<p className="mt-1 text-xs text-muted-foreground">{[item.category, item.grade, item.itemType, item.itemSubtype, item.isRare ? "Rare" : null].filter(Boolean).join(" · ") || "Классификация не указана"}</p></div>
        {canManage && <ActionMenu label={`Действия: ${item.displayName || item.canonicalName}`} items={[{ label: "Изменить предмет", onClick: () => { setEditingId(item.id); setCreating(false); } }]} />}
      </div>}
    </li>)}</ul>}
  </section>;
}
