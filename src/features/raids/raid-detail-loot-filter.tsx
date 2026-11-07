"use client";

import { useState, type ReactNode } from "react";
import type { RaidLootFilterCounts } from "@/features/raids/raid-detail-model";

type RaidLootFilter = keyof RaidLootFilterCounts;

const filters: { id: RaidLootFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "remaining", label: "Остались" },
  { id: "sold", label: "Есть продажи" },
];

export function RaidDetailLootFilter({
  counts,
  children,
}: {
  counts: RaidLootFilterCounts;
  children: ReactNode;
}) {
  const [filter, setFilter] = useState<RaidLootFilter>("all");
  const isEmpty = counts[filter] === 0;

  return (
    <div
      className="raidDetail-lootCollection"
      data-filter={filter}
      data-empty={isEmpty || undefined}
    >
      <div className="raidDetail-filterBar" role="group" aria-label="Фильтр предметов рейда">
        {filters.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className="raidDetail-filterButton"
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
          >
            {label} <span>{counts[id]}</span>
          </button>
        ))}
      </div>
      {children}
      {isEmpty && (
        <p className="raidDetail-filterEmpty" role="status">
          {filter === "sold"
            ? "Продаж по добыче этого рейда пока нет."
            : "Вся добыча этого рейда уже продана."}
        </p>
      )}
    </div>
  );
}
