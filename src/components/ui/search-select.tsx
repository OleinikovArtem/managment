"use client";
import { useMemo } from "react";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";
export type SearchOption = { id: string; label: string; search: string; scope?: string };
export function SearchSelect({
  rows,
  value,
  onChange,
  disabled = false,
  label,
  emptyLabel,
}: {
  rows: SearchOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
  label: string;
  emptyLabel: string;
}) {
  const options = useMemo(
    () => [{ id: "", label: emptyLabel, search: emptyLabel.toLowerCase() }, ...rows],
    [rows, emptyLabel],
  );
  return (
    <Combobox
      items={options}
      value={options.find((r) => r.id === (value ?? "")) ?? null}
      onValueChange={(row) => onChange(row?.id || null)}
      itemToStringLabel={(row) => row.label}
      isItemEqualToValue={(a, b) => a.id === b.id}
      filter={(row, query) => row.search.toLowerCase().includes(query.trim().toLowerCase())}
      disabled={disabled}
    >
      <ComboboxInput
        aria-label={label}
        className="min-h-11 w-full [&_input]:text-base"
        placeholder={emptyLabel}
        disabled={disabled}
      />
      <ComboboxContent>
        <ComboboxEmpty>Ничего не найдено.</ComboboxEmpty>
        <ComboboxList>
          {(row: SearchOption) => (
            <ComboboxItem key={row.id} value={row} className="min-h-11 px-3">
              <span>
                {row.label}
                {row.scope && (
                  <span className="ml-2 text-xs text-muted-foreground">{row.scope}</span>
                )}
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
