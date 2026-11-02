"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AdenaAmount } from "@/components/ui/adena-amount";
import { LocalDateTimeDisplay } from "@/features/raids/local-date-time-display";

export type HistoryEntry = { id: string; kind: "sale" | "payment"; amount: string; recordedAt: string; title: string; subtitle: string; comment: string | null; raidId: string | null; raidName: string | null; shares: { id: string; nickname: string; amount: string }[] };

export function HistoryList({ entries }: { entries: HistoryEntry[] }) {
  const [filter, setFilter] = useState<"all" | "sale" | "payment">("all");
  const filtered = useMemo(() => filter === "all" ? entries : entries.filter((entry) => entry.kind === filter), [entries, filter]);
  return <>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Показано: {filtered.length} из {entries.length}</p><select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} className="h-9 rounded-lg border border-input bg-background px-3 text-sm" aria-label="Тип события"><option value="all">Все события</option><option value="sale">Продажи</option><option value="payment">Передачи Adena</option></select></div>
    {filtered.length === 0 ? <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">Нет событий этого типа.</p> : <ol className="divide-y divide-border">{filtered.map((entry) => <li key={entry.id} className="py-3 first:pt-0 last:pb-0"><div className="flex items-center gap-3"><div className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${entry.kind === "sale" ? "bg-primary/10 text-primary" : "bg-emerald-400/10 text-emerald-300"}`}><Coins aria-hidden="true" size={15} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-medium">{entry.title}</h2><Badge variant={entry.kind === "sale" ? "secondary" : "outline"}>{entry.kind === "sale" ? "Продано" : "Передано"}</Badge></div><p className="truncate text-xs text-muted-foreground">{entry.subtitle}</p><p className="text-[11px] text-muted-foreground"><LocalDateTimeDisplay value={entry.recordedAt} />{entry.comment ? ` · ${entry.comment}` : ""}</p></div><p className="shrink-0 text-sm font-semibold"><AdenaAmount amount={entry.amount} /></p></div>{entry.kind === "sale" && entry.raidId && <div className="mt-2 ml-11 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"><Link href={`/raids/${entry.raidId}`} className="inline-flex items-center gap-1 text-primary hover:underline">{entry.raidName}<ArrowUpRight aria-hidden="true" size={12} /></Link><span className="text-muted-foreground">Доли: {entry.shares.map((share) => `${share.nickname} ${share.amount}`).join(" · ")}</span></div>}</li>)}</ol>}
  </>;
}
