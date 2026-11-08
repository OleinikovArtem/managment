"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InstanceSelect } from "@/features/instances/instance-select";
import type { InstanceOption } from "@/features/instances/catalog-schema";
import { LocalDateTimeDisplay } from "@/features/raids/local-date-time-display";
import { RaidListSkeleton } from "@/components/ui/page-skeleton";
import {
  getRaidPeriod,
  groupRaids,
  paginateRaidGroups,
  type RaidListRow,
} from "@/features/raids/raid-list-model";

const pageSize = 25;
const subscribeTimezone = () => () => {};
const dateOptions = [
  { value: "all", label: "Все даты" },
  { value: "today", label: "Сегодня" },
  { value: "yesterday", label: "Вчера" },
  { value: "week", label: "2–7 дней назад" },
  { value: "month", label: "8–30 дней назад" },
  { value: "older", label: "Раньше" },
  { value: "upcoming", label: "Предстоящие" },
] as const;

function readPage(value: string | null) {
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export function RaidList({ raids, instances }: { raids: RaidListRow[]; instances: InstanceOption[] }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const timezone = useSyncExternalStore(
    subscribeTimezone,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "server",
  );
  const [query, setQuery] = useState(() => params.get("q") ?? "");
  const [instance, setInstance] = useState(() => params.get("instance") ?? "");
  const [period, setPeriod] = useState(() => params.get("period") ?? "all");
  const [page, setPage] = useState(() => readPage(params.get("page")));
  const returnTo = `${pathname}${params.size ? `?${params}` : ""}`;

  useEffect(() => {
    function syncFromHistory() {
      const current = new URLSearchParams(window.location.search);
      setQuery(current.get("q") ?? "");
      setInstance(current.get("instance") ?? "");
      setPeriod(current.get("period") ?? "all");
      setPage(readPage(current.get("page")));
    }
    window.addEventListener("popstate", syncFromHistory);
    return () => window.removeEventListener("popstate", syncFromHistory);
  }, []);

  function writeParams(changes: Record<string, string>) {
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(changes)) {
      if (value && value !== "all") next.set(key, value);
      else next.delete(key);
    }
    window.history.replaceState(
      null,
      "",
      `${pathname}${next.size ? `?${next}` : ""}`,
    );
  }

  function updateFilter(key: "q" | "instance" | "period", value: string) {
    setPage(1);
    if (key === "q") setQuery(value);
    else if (key === "instance") setInstance(value);
    else setPeriod(value);
    writeParams({ [key]: value, page: "" });
  }

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");
    return raids.filter((raid) => {
      const instanceName = raid.instanceName?.trim() || "Без инстанса";
      const matchesQuery = `${raid.name} ${instanceName}`
        .toLocaleLowerCase("ru-RU")
        .includes(normalizedQuery);
      return (
        matchesQuery &&
        (!instance || raid.instanceId === instance) &&
        (period === "all" || getRaidPeriod(raid.occurredAt) === period)
      );
    });
  }, [raids, query, instance, period]);
  const groups = useMemo(
    () => groupRaids(filtered, new Date(), timezone === "server" ? undefined : timezone),
    [filtered, timezone],
  );
  const pages = useMemo(() => paginateRaidGroups(groups, pageSize), [groups]);
  const pageCount = Math.max(1, pages.length);
  const currentPage = Math.min(page, pageCount);
  const visibleGroups = pages[currentPage - 1] ?? [];

  function changePage(nextPage: number) {
    setPage(nextPage);
    writeParams({ page: String(nextPage) });
  }

  if (timezone === "server") return <RaidListSkeleton />;

  return (
    <section className="raid-list-workspace" aria-label="Список рейдов">
      <div className="toolbar raid-list-toolbar">
        <Input
          value={query}
          onChange={(event) => updateFilter("q", event.target.value)}
          placeholder="Название рейда или инстанса"
          aria-label="Поиск рейдов"
        />
        <InstanceSelect
          rows={instances}
          value={instance || null}
          onChange={(value) => updateFilter("instance", value ?? "")}
          disabled={false}
          emptyLabel="Все инстансы"
          label="Фильтр инстанса"
        />
        <label className="raid-filter-control">
          <span>Период</span>
          <select
            aria-label="Фильтр по периоду"
            value={period}
            onChange={(event) => updateFilter("period", event.target.value)}
          >
            {dateOptions.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <p role="status" className="raid-list-count">
          {filtered.length} {filtered.length === 1 ? "рейд" : "рейдов"}
        </p>
      </div>

      {visibleGroups.length === 0 ? (
        <div className="empty-state raid-list-empty">
          <p>
            {raids.length
              ? "Рейдов по этим условиям нет. Измените поиск или сбросьте фильтры."
              : "Запишите первый рейд: его состав, дату и добычу."}
          </p>
          {raids.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              className="mt-3"
              onClick={() => {
                setQuery("");
                setInstance("");
                setPeriod("all");
                setPage(1);
                const next = new URLSearchParams(window.location.search);
                for (const key of ["q", "instance", "period", "page"]) next.delete(key);
                next.set("view", "list");
                window.history.replaceState(null, "", `${pathname}?${next}`);
              }}
            >
              Сбросить фильтры
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="raid-date-groups">
            {visibleGroups.map((group) => (
              <section key={group.key} aria-labelledby={`raid-group-${group.key}`}>
                <h2 id={`raid-group-${group.key}`} className="raid-date-heading">
                  {group.label}
                  <span>{group.raids.length}</span>
                </h2>
                <ul className="data-list">
                  {group.raids.map((raid) => (
                    <li key={raid.id}>
                      <Link
                        href={`/raids/${raid.id}?returnTo=${encodeURIComponent(returnTo)}`}
                        className="list-row min-h-11"
                      >
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-medium">{raid.name}</h3>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {raid.instanceName && !raid.name.includes(raid.instanceName)
                              ? `${raid.instanceName} · `
                              : ""}
                            {raid.present} участников · поступлений: {raid.drops}
                          </p>
                        </div>
                        <LocalDateTimeDisplay
                          className="shrink-0 text-xs text-muted-foreground"
                          value={raid.occurredAt}
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          {pageCount > 1 && (
            <nav
              className="mt-5 flex items-center justify-between gap-3"
              aria-label="Страницы рейдов"
            >
              <Button
                variant="ghost"
                disabled={currentPage <= 1}
                onClick={() => changePage(currentPage - 1)}
              >
                Назад
              </Button>
              <span className="text-xs text-muted-foreground">
                {currentPage} / {pageCount}
              </span>
              <Button
                variant="ghost"
                disabled={currentPage >= pageCount}
                onClick={() => changePage(currentPage + 1)}
              >
                Вперёд
              </Button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
