"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Banknote, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdenaAmount } from "@/components/ui/adena-amount";
import { EditorDialog } from "@/components/ui/editor-dialog";
import { GameIcon } from "@/components/ui/game-icon";
import { LocalDateTime } from "@/components/ui/local-date-time";
import { SaleForm } from "@/features/sales/sale-form";
import type { LootRow } from "@/server/repositories/loot-repository";
import type { LootGroup } from "@/features/loot/loot-model";
import { formatSalesTooltip, getAverageUnitPrice, getLootCards } from "@/features/loot/loot-model";
import "./loot-list.css";

const statuses = [
  { value: "all", label: "Все" },
  { value: "sold", label: "Проданные" },
  { value: "unsold", label: "На продаже" },
] as const;
const statusLabels = { unsold: "Не продано", partial: "Частично продано", sold: "Продано" };
export function LootList({ rows, canManage }: { rows: LootRow[]; canManage: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const params = useSearchParams();
  const [activeRow, setActiveRow] = useState<LootGroup | null>(null);
  const [salePending, setSalePending] = useState(false);
  const onPendingChange = useCallback((next: boolean) => setSalePending(next), []);
  const query = params.get("q") ?? "";
  const status =
    params.get("status") === "sold" ? "sold" : params.get("status") === "unsold" ? "unsold" : "all";
  const combine = params.get("combine") === "1";
  const cards = useMemo(() => getLootCards(rows, combine), [rows, combine]);
  const activeDrop = activeRow?.drops.find((drop) => drop.remaining > 0) ?? activeRow?.drops[0];
  const matching = cards.filter((row) =>
    `${row.name} ${row.canonicalName} ${row.drops.map((drop) => drop.raidName).join(" ")}`
      .toLocaleLowerCase("ru-RU")
      .includes(query.trim().toLocaleLowerCase("ru-RU")),
  );
  const counts = {
    all: matching.length,
    unsold: matching.filter((row) => row.remaining > 0).length,
    sold: matching.filter((row) => row.remaining === 0).length,
  };
  const filtered = matching.filter(
    (row) => status === "all" || (status === "sold" ? row.remaining === 0 : row.remaining > 0),
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / 25));
  const pageParam = Number(params.get("page"));
  const page = Number.isSafeInteger(pageParam) ? Math.min(pageCount, Math.max(1, pageParam)) : 1;

  function change(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    router.replace(`${window.location.pathname}${next.size ? `?${next}` : ""}`, {
      scroll: false,
    });
  }

  return (
    <section className="loot-workspace" aria-label="Список лута">
      <div className="loot-toolbar">
        <Input
          value={query}
          onChange={(event) => change("q", event.target.value)}
          aria-label="Поиск лута"
          placeholder="Предмет или рейд"
        />
        <div className="loot-filters" role="group" aria-label="Статус продажи">
          {statuses.map((option) => (
            <Button
              key={option.value}
              variant={status === option.value ? "secondary" : "ghost"}
              className="min-h-11"
              aria-pressed={status === option.value}
              onClick={() => change("status", option.value === "all" ? "" : option.value)}
            >
              {option.label} <span>{counts[option.value]}</span>
            </Button>
          ))}
        </div>
        <label className="loot-combine-toggle">
          <input
            type="checkbox"
            checked={combine}
            onChange={(event) => change("combine", event.target.checked ? "1" : "")}
          />
          <span>Объединить одинаковые</span>
        </label>
        <Button
          variant="ghost"
          disabled={pending}
          className="min-h-11 loot-refresh"
          onClick={() => startTransition(() => router.refresh())}
        >
          {pending ? "Обновление…" : "Обновить"}
        </Button>
      </div>
      <p role="status" className="loot-count">
        Карточек: {filtered.length}.
        {combine && " Объединённые позиции продаются FIFO: сначала самое раннее поступление."}
      </p>
      {filtered.length === 0 ? (
        <div className="empty-state">
          <p>
            {cards.length === 0
              ? "Пока нет добычи. Добавьте лут при создании рейда."
              : query.trim()
                ? "Лут не найден. Измените поиск или фильтр."
                : status === "sold"
                  ? "Продаж пока нет."
                  : "Непроданных предметов нет."}
          </p>
          {cards.length === 0 && (
            <Link href="/raids" className="mt-3 inline-flex min-h-11 items-center underline">
              Перейти к рейдам →
            </Link>
          )}
        </div>
      ) : (
        <ul className="loot-grid">
          {filtered.slice((page - 1) * 25, page * 25).map((row) => {
            const latestDrop = row.drops[row.drops.length - 1];
            const averageUnitPrice = getAverageUnitPrice(row.proceeds, row.sold);
            const salesTooltip = formatSalesTooltip(row.sales);
            return (
              <li key={row.id}>
                <article className={`loot-card${row.status === "sold" ? " is-sold" : ""}`}>
                  <header className="loot-card-heading">
                    <GameIcon
                      kind="item"
                      name={row.canonicalName}
                      category={row.category}
                      size="lg"
                    />
                    <h2 title={row.name}>{row.name}</h2>
                  </header>
                  <div className="loot-card-meta">
                    <span>{row.category || "Предмет"}</span>
                    {row.status === "sold" && <span className="loot-sold-stamp">Продано</span>}
                  </div>
                  <p className="loot-raid-link">
                    <Link href={`/raids/${latestDrop.raidId}`} title={latestDrop.raidName}>
                      {latestDrop.raidName} ↗
                    </Link>
                    <span>
                      <LocalDateTime value={latestDrop.occurredAt} />
                    </span>
                    {row.drops.length > 1 && <span>ещё {row.drops.length - 1} поступл.</span>}
                  </p>
                  <dl className="loot-quantities">
                    <div>
                      <dt>Добыто</dt>
                      <dd>{row.quantity}</dd>
                    </div>
                    <div>
                      <dt>Продано</dt>
                      <dd>{row.sold}</dd>
                    </div>
                    <div>
                      <dt>Остаток</dt>
                      <dd>{row.remaining}</dd>
                    </div>
                  </dl>
                  <div className="loot-card-foot">
                    <span className={`loot-status is-${row.status}`}>
                      <i aria-hidden="true" />
                      {statusLabels[row.status]}
                    </span>
                    {row.sold > 0 && averageUnitPrice !== null && (
                      <span
                        className="loot-proceeds"
                        title={`Продажи:${salesTooltip ? `\n${salesTooltip}` : ""}`}
                      >
                        <span className="loot-average-price">
                          <AdenaAmount amount={averageUnitPrice} />
                          <small> / шт.</small>
                        </span>
                        <small>{BigInt(row.proceeds).toLocaleString("ru-RU")} Adena</small>
                      </span>
                    )}
                  </div>
                  <div className="loot-card-action">
                    {row.remaining > 0 && canManage ? (
                      <Button type="button" variant="outline" onClick={() => setActiveRow(row)}>
                        <Banknote aria-hidden="true" size={15} />
                        Отметить продажу
                      </Button>
                    ) : row.remaining === 0 ? (
                      <span className="loot-sold-action">
                        <Check size={15} aria-hidden="true" />
                        Продано
                      </span>
                    ) : (
                      <span className="loot-status">Остаток к продаже: {row.remaining} шт.</span>
                    )}
                    <span className="loot-added">
                      Последнее поступление <LocalDateTime value={row.latestCreatedAt} />
                    </span>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
      {pageCount > 1 && (
        <nav className="mt-5 flex items-center justify-between" aria-label="Страницы лута">
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
      {activeRow && (
        <EditorDialog
          open
          onClose={() => {
            if (!salePending) setActiveRow(null);
          }}
          title="Отметить продажу"
          description={`${activeRow.name}${combine ? " · FIFO" : ""} · рейд: ${activeDrop?.raidName ?? activeRow.raidName}`}
        >
          <div className="loot-sale-dialog-item">
            <GameIcon
              kind="item"
              name={activeRow.canonicalName}
              category={activeRow.category}
              size="lg"
            />
            <p>
              <span>{combine ? "Доступно по всем поступлениям" : "Доступно в поступлении"}</span>
              <strong>{activeRow.remaining} шт.</strong>
            </p>
          </div>
          <SaleForm
            lootDropId={combine ? undefined : activeRow.drops[0].id}
            itemId={combine ? activeRow.itemId : undefined}
            remainingQuantity={activeRow.remaining}
            variant="dialog"
            open
            onOpenChange={(open) => {
              if (!open && !salePending) setActiveRow(null);
            }}
            onPendingChange={onPendingChange}
          />
        </EditorDialog>
      )}
    </section>
  );
}
