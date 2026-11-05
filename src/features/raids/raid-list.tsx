"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LocalDateTimeDisplay } from "@/features/raids/local-date-time-display";

type RaidRow = { id: string; name: string; instanceName: string | null; occurredAt: string; present: number; drops: number };

export function RaidList({ raids }: { raids: RaidRow[] }) {
  const params = useSearchParams();
  const query = params.get("q") ?? "";
  const rows = raids.filter(raid => `${raid.name} ${raid.instanceName ?? ""}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const pageCount = Math.max(1, Math.ceil(rows.length / 25));
  const page = Math.min(pageCount, Math.max(1, Number(params.get("page")) || 1));
  function change(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    if (key !== "page") next.delete("page");
    window.history.replaceState(null, "", `${window.location.pathname}${next.size ? `?${next}` : ""}`);
  }
  return <section>
    <div className="toolbar"><Input value={query} onChange={e => change("q", e.target.value)} placeholder="Название рейда или инстанса" aria-label="Поиск рейдов" /><p role="status" className="text-xs text-muted-foreground">Найдено: {rows.length}</p></div>
    {rows.length === 0 ? <p className="empty-state">{raids.length ? "Рейды не найдены. Измените поиск." : "Запишите первый рейд: его состав, дату и добычу."}</p> : <ul className="data-list">{rows.slice((page - 1) * 25, page * 25).map(raid => <li key={raid.id}><Link href={`/raids/${raid.id}`} className="list-row min-h-11"><div><h2 className="text-sm font-medium">{raid.name}</h2><p className="mt-1 text-xs text-muted-foreground">{raid.instanceName && !raid.name.includes(raid.instanceName) ? `${raid.instanceName} · ` : ""}{raid.present} участников · поступлений: {raid.drops}</p></div><span className="shrink-0 text-xs text-muted-foreground"><LocalDateTimeDisplay value={raid.occurredAt} /></span></Link></li>)}</ul>}
    {pageCount > 1 && <nav className="mt-5 flex items-center justify-between" aria-label="Страницы рейдов"><Button variant="ghost" disabled={page <= 1} onClick={() => change("page", String(page - 1))}>Назад</Button><span className="text-xs text-muted-foreground">{page} / {pageCount}</span><Button variant="ghost" disabled={page >= pageCount} onClick={() => change("page", String(page + 1))}>Вперёд</Button></nav>}
  </section>;
}
