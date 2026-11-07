"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EditorDialog } from "@/components/ui/editor-dialog";
import { GameIcon } from "@/components/ui/game-icon";
import { ItemForm } from "@/features/items/item-form";
import { createItemAction } from "@/app/(dashboard)/items/actions";
import { getRaidItemAction } from "@/app/(dashboard)/raids/item-action";
import { searchRaidItemsAction } from "@/app/(dashboard)/raids/catalog-actions";
import type { CatalogItemOption } from "@/features/instances/catalog-schema";
import type { RaidFormValues } from "./raid-schema";

export type LootEntry = RaidFormValues["lootDrops"][number];
type Props = { value: LootEntry[]; onChange: (rows: LootEntry[]) => void; initialItems: CatalogItemOption[]; recommended: CatalogItemOption[]; quick: CatalogItemOption[]; disabled: boolean; loading: boolean; onPreset?: (kind: "custom" | "quick") => void; custom: boolean };

export function LootPicker({ value, onChange, initialItems, recommended, quick, disabled, loading, onPreset, custom }: Props) {
  const [tab, setTab] = useState("recommended");
  const [catalog, setCatalog] = useState(initialItems);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogItemOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [searchRevision, setSearchRevision] = useState(0);
  const quantities = useRef(new Map<string, HTMLInputElement>());
  useEffect(() => {
    if (!open && tab !== "all") return;
    let active = true;
    const timer = setTimeout(() => {
      setSearching(true); setSearchError("");
      searchRaidItemsAction(query).then(rows => { if (active) { setResults(rows); setCatalog(previous => [...new Map([...previous, ...rows].map(item => [item.id, item])).values()]); } }).catch(() => { if (active) setSearchError("Не удалось загрузить каталог. Повторите поиск."); }).finally(() => { if (active) setSearching(false); });
    }, 180);
    return () => { active = false; clearTimeout(timer); };
  }, [query, open, tab, searchRevision]);
  const all = new Map([...initialItems, ...catalog, ...recommended, ...quick].map(item => [item.id, item]));
  const shown = tab === "all" ? results : tab === "quick" ? quick : recommended;
  function add(item: CatalogItemOption) {
    const index = value.findIndex(row => row.itemId === item.id && !row.id);
    if (index >= 0) { quantities.current.get(`new-${item.id}`)?.focus(); return; }
    setCatalog(previous => [...previous.filter(row => row.id !== item.id), item]);
    onChange([...value, { itemId: item.id, quantity: 1, comment: "" }]);
  }
  function update(index: number, patch: Partial<LootEntry>) { onChange(value.map((entry, i) => i === index ? { ...entry, ...patch } : entry)); }
  const pickedIds = new Set(value.map(row => row.itemId));
  return <div>
    <div className="raid-loot-tabs" role="tablist" aria-label="Предметы для добычи">{[["recommended", "Возможный дроп"], ["quick", "Быстрый"], ["all", "Все предметы"]].map(([id, label], index, tabs) => <button key={id} type="button" role="tab" id={`loot-tab-${id}`} aria-controls="raid-loot-panel" aria-selected={tab === id} tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)} onKeyDown={event => { if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); const next = tabs[(index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length][0]; setTab(next); document.getElementById(`loot-tab-${next}`)?.focus(); } }}>{label}</button>)}</div>
    <div className="raid-loot-toolbar">{tab === "all" ? <Input aria-label="Поиск по каталогу" placeholder="Найти предмет…" value={query} onChange={event => setQuery(event.target.value)} maxLength={200} /> : <p>{loading ? "Обновляем рекомендации…" : shown.length ? "Добавляйте только то, что выпало." : "Рекомендации пока не заполнены. Добавьте предмет из каталога."}</p>}{onPreset && (tab === "quick" || (tab === "recommended" && custom)) && <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onPreset(tab === "quick" ? "quick" : "custom")}>Настроить</Button>}</div>
    {searchError && <p role="alert" className="text-sm text-destructive">{searchError}<button type="button" className="ml-2 underline" onClick={() => setSearchRevision(count => count + 1)}>Повторить</button></p>}
    <div id="raid-loot-panel" role="tabpanel" aria-labelledby={`loot-tab-${tab}`} aria-busy={loading || searching} className="raid-loot-grid">
      {value.map((row, index) => {
        const item = all.get(row.itemId);
        const key = row.id ?? `new-${row.itemId}`;
        const name = item?.displayName || item?.canonicalName || "Предмет";
        return <article key={key} className="raid-loot-tile is-selected">
          <GameIcon kind="item" name={item?.canonicalName ?? name} category={item?.category} size="lg" />
          {!row.id && <button type="button" className="raid-loot-remove" aria-label={`Удалить ${name}`} disabled={disabled} onClick={() => onChange(value.filter((_, i) => i !== index))}><Trash2 size={15} aria-hidden="true" /></button>}
          <h3>{name}</h3><p className="raid-tile-meta">{row.id ? "Историческое поступление" : item?.category || "Добыча рейда"}</p>
          <div className="raid-quantity"><button type="button" aria-label={`Уменьшить ${name}`} disabled={disabled || !(row.quantity > 1)} onClick={() => update(index, { quantity: Math.max(1, row.quantity - 1) })}>−</button><input ref={element => { if (element) quantities.current.set(key, element); else quantities.current.delete(key); }} aria-label={`Количество ${name}`} type="number" inputMode="numeric" min={1} max={1_000_000} step={1} disabled={disabled} value={Number.isNaN(row.quantity) ? "" : row.quantity} onChange={event => update(index, { quantity: event.target.valueAsNumber })} /><button type="button" aria-label={`Увеличить ${name}`} disabled={disabled || row.quantity >= 1_000_000} onClick={() => update(index, { quantity: Number.isNaN(row.quantity) ? 1 : row.quantity + 1 })}>+</button></div>
          <details className="raid-item-comment"><summary>Комментарий</summary><Input aria-label={`Комментарий ${name}`} maxLength={500} disabled={disabled} value={row.comment ?? ""} onChange={event => update(index, { comment: event.target.value })} /></details>
        </article>;
      })}
      {shown.filter(item => !pickedIds.has(item.id)).map(item => <article key={item.id} className="raid-loot-tile"><GameIcon kind="item" name={item.canonicalName} category={item.category} size="lg" /><h3>{item.displayName || item.canonicalName}</h3><p className="raid-tile-meta">{item.category || "Каталог"}</p><button type="button" className="raid-tile-add" disabled={disabled} aria-label={`Добавить ${item.displayName || item.canonicalName}`} onClick={() => add(item)}><Plus size={16} aria-hidden="true" /></button></article>)}
      <button type="button" className="raid-add-tile" disabled={disabled} onClick={() => { setOpen(true); setCreating(false); }}><Plus size={32} strokeWidth={1} aria-hidden="true" /><span>Добавить предмет</span></button>
    </div>
    <EditorDialog open={open} onClose={() => setOpen(false)} title="Добавить предмет" description="Общий каталог и собственные предметы вашей группы.">
      {creating ? <><ItemForm action={createItemAction} submitLabel="Создать свой предмет" onCancel={() => setCreating(false)} onSuccess={async id => { if (!id) return; try { const created = await getRaidItemAction(id); if (created) add(created); else toast.error("Предмет создан, но недоступен для выбора."); } catch { toast.error("Предмет создан. Найдите его в каталоге и добавьте повторно."); } setOpen(false); }} /></> : <><Input autoFocus aria-label="Поиск предмета" placeholder="Название предмета…" value={query} maxLength={200} onChange={event => setQuery(event.target.value)} /><div className="mt-3 max-h-80 space-y-2 overflow-auto">{searching ? <p className="text-sm text-muted-foreground">Поиск…</p> : results.map(item => <button type="button" className="flex min-h-14 w-full items-center gap-3 rounded-md border border-border p-3 text-left text-sm hover:bg-muted" key={item.id} onClick={() => { add(item); setOpen(false); }}><GameIcon kind="item" name={item.canonicalName} category={item.category} size="sm" /><span className="flex-1">{item.displayName || item.canonicalName}<small className="mt-1 block text-xs text-muted-foreground">{item.partyId ? "Свой предмет" : "Общий каталог"}</small></span><Plus size={16} aria-hidden="true" /></button>)}{!searching && !results.length && <p className="text-sm text-muted-foreground">Предмет не найден.</p>}</div><Button type="button" className="mt-4" variant="outline" onClick={() => setCreating(true)}>Создать свой предмет</Button></>}
    </EditorDialog>
  </div>;
}\n