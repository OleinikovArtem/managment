"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AdenaAmount } from "@/components/ui/adena-amount";
import { LocalDateTimeDisplay } from "@/features/raids/local-date-time-display";
import { cn } from "cn";

const operationFilters = [
  { value: "all", label: "Все" },
  { value: "sale", label: "Продажи" },
  { value: "payment", label: "Передачи" },
] as const;

export type HistoryEntry = {
  id: string;
  kind: "sale" | "payment";
  amount: string;
  recordedAt: string;
  title: string;
  subtitle: string;
  comment: string | null;
  raidId: string | null;
  raidName: string | null;
  shares: { id: string; nickname: string; amount: string }[];
};

export function HistoryList({ entries }: { entries: HistoryEntry[] }) {
  const params = useSearchParams();
  const filter = params.get("type") ?? "all";
  const query = params.get("q") ?? "";
  const pageParam = Number(params.get("page")) || 1;
  const filtered = useMemo(
    () =>
      entries.filter(
        (entry) =>
          (filter === "all" || entry.kind === filter) &&
          `${entry.subtitle} ${entry.raidName ?? ""} ${entry.comment ?? ""} ${entry.shares.map((s) => s.nickname).join(" ")}`
            .toLocaleLowerCase()
            .includes(query.toLocaleLowerCase()),
      ),
    [entries, filter, query],
  );
  const counts = {
    all: entries.length,
    sale: entries.filter((entry) => entry.kind === "sale").length,
    payment: entries.filter((entry) => entry.kind === "payment").length,
  };
  const pageCount = Math.max(1, Math.ceil(filtered.length / 25));
  const page = Math.min(Math.max(1, pageParam), pageCount);
  function change(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value && value !== "all") next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${next.size ? `?${next}` : ""}`,
    );
  }
  return (
    <>
      <div className="toolbar finance-toolbar">
        <Input
          aria-label="Поиск операций"
          placeholder="Предмет, участник или рейд"
          value={query}
          onChange={(e) => change("q", e.target.value)}
        />
        <div className="finance-segmented" role="group" aria-label="Тип операции">
          {operationFilters.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant="ghost"
              className={cn("finance-segmented-option", filter === option.value && "is-active")}
              aria-pressed={filter === option.value}
              onClick={() => change("type", option.value)}
            >
              {option.label} <span>{counts[option.value]}</span>
            </Button>
          ))}
        </div>
      </div>
      <p className="finance-list-summary" role="status">
        Найдено {filtered.length} из {entries.length}
        {pageCount > 1 && ` · страница ${page} из ${pageCount}`}
      </p>
      {filtered.length === 0 ? (
        <p className="empty-state">
          {entries.length
            ? "Операций по этим условиям нет. Измените поиск или фильтр."
            : "Продажи и передачи появятся здесь после записи."}
        </p>
      ) : (
        <ol className="finance-operation-list">
          {filtered.slice((page - 1) * 25, page * 25).map((entry) => (
            <li key={entry.id}>
              <details className="disclosure finance-operation">
                <summary>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{entry.subtitle}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {entry.kind === "sale" ? "Продажа · в банк" : "Передача · из банка"} ·{" "}
                      <LocalDateTimeDisplay value={entry.recordedAt} />
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-medium tabular-nums">
                    <span className="mr-1 text-muted-foreground">
                      {entry.kind === "sale" ? "+" : "−"}
                    </span>
                    <AdenaAmount amount={entry.amount} />
                  </span>
                </summary>
                <div className="pt-4 text-sm">
                  <p className="text-muted-foreground">
                    Точная сумма: {BigInt(entry.amount).toLocaleString("ru-RU")} Adena
                  </p>
                  {entry.raidId && (
                    <Link
                      href={`/raids/${entry.raidId}`}
                      className="mt-3 inline-block underline underline-offset-4"
                    >
                      {entry.raidName}
                    </Link>
                  )}
                  {entry.comment && (
                    <p className="mt-3 whitespace-pre-wrap text-muted-foreground">
                      {entry.comment}
                    </p>
                  )}
                  {entry.shares.length > 0 && (
                    <div className="finance-share-section mt-4">
                      <h3 className="mb-2 text-xs font-semibold">Доли участников</h3>
                      <ul className="grid grid-cols-1 gap-1.5 min-[520px]:grid-cols-[repeat(auto-fill,minmax(160px,1fr))]">
                        {entry.shares.map((share) => (
                          <li
                            key={share.id}
                            className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-border bg-card/75 p-2 max-[639px]:items-start max-[639px]:flex-col max-[639px]:gap-1"
                          >
                            <span className="min-w-0 break-words text-xs font-medium">{share.nickname}</span>
                            <span className="shrink-0 text-right text-[11px] tabular-nums max-[639px]:text-left">
                              <AdenaAmount amount={share.amount} />
                              <span className="mt-0.5 block text-[10px] text-muted-foreground">
                                {BigInt(share.amount).toLocaleString("ru-RU")} Adena
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </details>
            </li>
          ))}
        </ol>
      )}
      {pageCount > 1 && (
        <nav
          aria-label="Страницы операций"
          className="mt-5 flex items-center justify-between gap-3"
        >
          <Button
            variant="ghost"
            disabled={page <= 1}
            onClick={() => change("page", String(page - 1))}
          >
            Назад
          </Button>
          <span className="text-xs text-muted-foreground">
            {page} / {pageCount}
          </span>
          <Button
            variant="ghost"
            disabled={page >= pageCount}
            onClick={() => change("page", String(page + 1))}
          >
            Вперёд
          </Button>
        </nav>
      )}
    </>
  );
}
