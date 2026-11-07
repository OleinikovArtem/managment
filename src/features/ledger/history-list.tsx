"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AdenaAmount } from "@/components/ui/adena-amount";
import { LocalDateTimeDisplay } from "@/features/raids/local-date-time-display";

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
      <div className="toolbar">
        <Input
          aria-label="Поиск операций"
          placeholder="Предмет, участник или рейд"
          value={query}
          onChange={(e) => change("q", e.target.value)}
        />
        <select
          aria-label="Тип операции"
          value={filter}
          onChange={(e) => change("type", e.target.value)}
        >
          <option value="all">Все операции</option>
          <option value="sale">Продажи</option>
          <option value="payment">Передачи</option>
        </select>
      </div>
      <p className="mb-4 text-xs text-muted-foreground" role="status">
        Найдено: {filtered.length} · страница {page} из {pageCount}
      </p>
      {filtered.length === 0 ? (
        <p className="empty-state">
          {entries.length
            ? "Операций по этим условиям нет. Измените поиск или фильтр."
            : "Продажи и передачи появятся здесь после записи."}
        </p>
      ) : (
        <ol className="data-list">
          {filtered.slice((page - 1) * 25, page * 25).map((entry) => (
            <li key={entry.id}>
              <details className="disclosure">
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
                    <div className="mt-4">
                      <h3 className="mb-2 font-medium">Доли участников</h3>
                      <ul>
                        {entry.shares.map((share) => (
                          <li key={share.id} className="grid grid-cols-2 gap-4 py-2">
                            <span className="break-words">{share.nickname}</span>
                            <span className="text-right">
                              <AdenaAmount amount={share.amount} />
                              <span className="mt-1 block text-xs text-muted-foreground">
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
