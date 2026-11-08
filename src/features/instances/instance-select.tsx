"use client";
import { useMemo } from "react";
import type { InstanceOption } from "./catalog-schema";
import { SearchSelect } from "@/components/ui/search-select";
export function InstanceSelect({
  rows,
  value,
  onChange,
  disabled,
  emptyLabel = "Без инстанса",
  label = "Инстанс",
}: {
  rows: InstanceOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  disabled: boolean;
  emptyLabel?: string;
  label?: string;
}) {
  const options = useMemo(
    () =>
      rows
        .filter((r) => r.isActive || r.id === value)
        .sort((a, b) => Number(Boolean(a.partyId)) - Number(Boolean(b.partyId)))
        .map((r) => ({
          id: r.id,
          label: r.displayName,
          search: `${r.name} ${r.displayName} ${r.aliases.join(" ")}`,
          scope: `${r.partyId ? "Мой инстанс" : "Стандартный"}${!r.isActive ? " · Архив" : ""}`,
        })),
    [rows, value],
  );
  return (
    <SearchSelect
      rows={options}
      value={value}
      onChange={onChange}
      disabled={disabled}
      label={label}
      emptyLabel={emptyLabel}
    />
  );
}
