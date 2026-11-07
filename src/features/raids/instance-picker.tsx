"use client";
import { useId, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { InstanceOption } from "@/features/instances/catalog-schema";

export function InstancePicker({
  rows,
  value,
  onChange,
  disabled,
}: {
  rows: InstanceOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  disabled: boolean;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const selected = rows.find((row) => row.id === value);
  const shown = useMemo(
    () =>
      rows
        .filter(
          (row) =>
            (row.isActive || row.id === value) &&
            `${row.name} ${row.displayName} ${row.aliases.join(" ")}`
              .toLowerCase()
              .includes(query.trim().toLowerCase()),
        )
        .sort((a, b) => Number(Boolean(a.partyId)) - Number(Boolean(b.partyId))),
    [rows, query, value],
  );
  function choose(id: string | null) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }
  return (
    <div className="relative">
      <label className="sr-only" htmlFor={`${listId}-input`}>
        Инстанс
      </label>
      <Input
        id={`${listId}-input`}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && shown[index] ? `${listId}-${shown[index].id}` : undefined}
        value={open ? query : (selected?.displayName ?? "")}
        placeholder="Выбрать инстанс"
        className="pr-9"
        disabled={disabled}
        onFocus={() => {
          setOpen(true);
          setIndex(0);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setIndex(0);
          setOpen(true);
        }}
        onBlur={(event) => {
          if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) {
            setOpen(false);
            setQuery("");
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setIndex((current) =>
              Math.max(
                0,
                Math.min(shown.length - 1, current + (event.key === "ArrowDown" ? 1 : -1)),
              ),
            );
          } else if (event.key === "Enter" && open) {
            event.preventDefault();
            if (shown[index]) choose(shown[index].id);
          } else if (event.key === "Escape") {
            setOpen(false);
            setQuery("");
          }
        }}
      />
      <ChevronDown
        size={15}
        className="pointer-events-none absolute right-3 top-4 text-muted-foreground"
        aria-hidden="true"
      />
      {open && (
        <div
          role="listbox"
          id={listId}
          className="absolute z-20 mt-2 max-h-80 w-full min-w-64 overflow-auto rounded-md border border-border bg-popover p-1 shadow-xl"
        >
          <button
            type="button"
            role="option"
            aria-selected={!value}
            className="min-h-11 w-full px-3 text-left text-sm text-muted-foreground"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(null)}
          >
            Без инстанса
          </button>
          {[false, true].map((own) => (
            <div role="group" aria-label={own ? "Мои инстансы" : "Стандартные"} key={String(own)}>
              <p className="px-3 py-2 text-xs text-muted-foreground">
                {own ? "Мои инстансы" : "Стандартные"}
              </p>
              {shown
                .filter((row) => Boolean(row.partyId) === own)
                .map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    id={`${listId}-${row.id}`}
                    role="option"
                    aria-selected={row.id === value}
                    className={`min-h-11 w-full rounded px-3 py-2 text-left text-sm hover:bg-muted ${shown[index]?.id === row.id ? "bg-accent" : ""}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(row.id)}
                  >
                    {row.displayName}
                    {row.source === "SERVER_VARIANT" && (
                      <span className="ml-2 text-[11px] text-muted-foreground">Серверный</span>
                    )}
                    {!row.isActive && <span className="ml-2 text-xs">Архив</span>}
                  </button>
                ))}
            </div>
          ))}
          {!shown.length && (
            <p className="p-3 text-sm text-muted-foreground">
              Ничего не найдено. Можно добавить свой инстанс кнопкой +.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
