"use client";

import { useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { RaidItemOption } from "@/features/raids/raid-form";

type ItemComboboxProps = {
  id: string;
  items: RaidItemOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function ItemCombobox({ id, items, value, onChange, disabled }: ItemComboboxProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selected = items.find((item) => item.id === value);
  const visibleItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return items.slice(0, 8);
    return items.filter((item) => `${item.displayName ?? ""} ${item.canonicalName}`.toLocaleLowerCase().includes(normalized)).slice(0, 8);
  }, [items, query]);

  function choose(item: RaidItemOption) {
    onChange(item.id);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">Предмет</label>
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
          aria-autocomplete="list"
          aria-activedescendant={open && visibleItems[activeIndex] ? `${id}-option-${visibleItems[activeIndex].id}` : undefined}
          value={open ? query : selected?.displayName || selected?.canonicalName || ""}
          placeholder="Начните вводить название предмета…"
          className="pr-9 pl-9"
          disabled={disabled}
          onFocus={() => {
            if (blurTimer.current) clearTimeout(blurTimer.current);
            setOpen(true);
            setActiveIndex(0);
          }}
          onBlur={() => {
            blurTimer.current = setTimeout(() => setOpen(false), 120);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((index) => Math.min(index + 1, Math.max(visibleItems.length - 1, 0)));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((index) => Math.max(index - 1, 0));
            } else if (event.key === "Enter" && open && visibleItems[activeIndex]) {
              event.preventDefault();
              choose(visibleItems[activeIndex]);
            } else if (event.key === "Escape") {
              setOpen(false);
              setQuery("");
            }
          }}
        />
        <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>
      {open && (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-2xl" role="listbox" id={`${id}-listbox`}>
          {visibleItems.length > 0 ? visibleItems.map((item, index) => (
            <button type="button" role="option" aria-selected={item.id === value} id={`${id}-option-${item.id}`} key={item.id} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${index === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-muted"}`} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(item)}>
              <span className="min-w-0 flex-1 truncate">{item.displayName || item.canonicalName}</span>
              {item.displayName && <span className="hidden max-w-[42%] truncate text-xs text-muted-foreground sm:block">{item.canonicalName}</span>}
              {item.id === value && <Check aria-hidden="true" className="size-4 shrink-0 text-primary" />}
            </button>
          )) : <p className="px-3 py-3 text-sm text-muted-foreground">Предмет не найден</p>}
        </div>
      )}
    </div>
  );
}
