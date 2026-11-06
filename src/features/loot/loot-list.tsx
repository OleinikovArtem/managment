"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdenaAmount } from "@/components/ui/adena-amount";
import { LocalDateTime } from "@/components/ui/local-date-time";
import type { LootRow } from "@/server/repositories/loot-repository";

const statuses = [
  { value: "all", label: "Все" },
  { value: "unsold", label: "Непроданные" },
  { value: "sold", label: "Проданные" },
] as const;
const statusLabels = { unsold: "Не продано", partial: "Частично продано", sold: "Продано" };

export function LootList({ rows }: { rows: LootRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const params = useSearchParams();
  const query = params.get("q") ?? "";
  const status = params.get("status") === "sold" ? "sold" : params.get("status") === "unsold" ? "unsold" : "all";
  const matching = rows.filter(row => `${row.name} ${row.canonicalName} ${row.raidName}`.toLocaleLowerCase("ru-RU").includes(query.trim().toLocaleLowerCase("ru-RU")));
  const counts = {
    all: matching.length, unsold: matching.filter(row => row.remaining > 0).length,
    sold: matching.filter(row => row.sold > 0).length,
  };
  const filtered = matching.filter(row => status === "all" || (status === "sold" ? row.sold > 0 : row.remaining > 0));
  const pageCount = Math.max(1, Math.ceil(filtered.length / 25));
  const pageParam = Number(params.get("page"));
  const page = Number.isSafeInteger(pageParam) ? Math.min(pageCount, Math.max(1, pageParam)) : 1;
  function change(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    if (key !== "page") next.delete("page");
    window.history.replaceState(null, "", `/loot${next.size ? `?${next}` : ""}`);
  }
  return <section aria-label="Список лута">
    <div className="toolbar">
      <Input value={query} onChange={event => change("q", event.target.value)} aria-label="Поиск лута" placeholder="Предмет или рейд" />
      <div className="flex flex-wrap gap-1" role="group" aria-label="Статус продажи">
        {statuses.map(option => <Button key={option.value} variant={status === option.value ? "secondary" : "ghost"} className="min-h-11" aria-pressed={status === option.value} onClick={() => change("status", option.value === "all" ? "" : option.value)}>{option.label} <span className="ml-1 text-xs tabular-nums text-muted-foreground">{counts[option.value]}</span></Button>)}
      </div>
      <Button variant="ghost" disabled={pending} className="min-h-11 sm:ml-auto" onClick={() => startTransition(() => router.refresh())}>{pending ? "Обновление…" : "Обновить"}</Button>
    </div>
    <p role="status" className="mb-4 text-xs text-muted-foreground">Поступлений: {filtered.length}. Частично проданные есть в обоих фильтрах.</p>
    {filtered.length === 0 ? <div className="empty-state">
      <p>{rows.length === 0 ? "Пока нет добычи. Добавьте лут при создании рейда." : query.trim() ? "Лут не найден. Измените поиск или фильтр." : status === "sold" ? "Продаж пока нет." : "Непроданных предметов нет."}</p>
      {rows.length === 0 && <Link href="/raids" className="mt-3 inline-flex min-h-11 items-center underline underline-offset-4">Перейти к рейдам →</Link>}
    </div> : <ul className="data-list">{filtered.slice((page - 1) * 25, page * 25).map(row => <li key={row.id}>
      <article className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]" aria-label={row.name}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><h2 className="break-words text-sm font-semibold">{row.name}</h2><span className="text-xs text-muted-foreground">{statusLabels[row.status]}</span></div>
          <p className="mt-2 break-words text-xs text-muted-foreground"><Link href={`/raids/${row.raidId}`} className="inline-flex min-h-8 items-center text-foreground underline decoration-border underline-offset-4">{row.raidName} ↗</Link><span className="ml-2"><LocalDateTime value={row.occurredAt} /></span></p>
          <p className="mt-1 text-xs text-muted-foreground">Добавлено: <LocalDateTime value={row.createdAt} /></p>
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs">
            <div><dt className="text-muted-foreground">Получено</dt><dd className="mt-1 tabular-nums">{row.quantity} шт.</dd></div>
            <div><dt className="text-muted-foreground">Продано</dt><dd className="mt-1 tabular-nums">{row.sold} шт.</dd></div>
            <div><dt className="text-muted-foreground">Осталось</dt><dd className="mt-1 font-semibold tabular-nums">{row.remaining} шт.</dd></div>
          </dl>
        </div>
        {row.sold > 0 && <div className="sm:text-right"><p className="text-xs text-muted-foreground">Сумма продаж</p><p className="mt-1 text-base font-semibold tabular-nums"><AdenaAmount amount={row.proceeds} /></p><p className="mt-1 text-xs text-muted-foreground">{BigInt(row.proceeds).toLocaleString("ru-RU")} Adena</p></div>}
      </article>
    </li>)}</ul>}
    {pageCount > 1 && <nav className="mt-5 flex items-center justify-between" aria-label="Страницы лута"><Button variant="ghost" disabled={page <= 1} onClick={() => change("page", String(page - 1))}>Назад</Button><span className="text-xs text-muted-foreground">{page} / {pageCount}</span><Button variant="ghost" disabled={page >= pageCount} onClick={() => change("page", String(page + 1))}>Вперёд</Button></nav>}
  </section>;
}
