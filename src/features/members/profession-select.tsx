"use client";

import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronDown, X } from "lucide-react";
import type { Ref } from "react";
import {
  buildProfessionOptions,
  resolveSelectedProfessionOption,
  type ProfessionOption,
  type ProfessionProfile,
} from "@/features/members/profession-options";

export function ProfessionSelect({
  mainClass,
  profiles,
  value,
  preserved,
  id,
  onBlur,
  inputRef,
  onChange,
  disabled,
  "aria-label": ariaLabel,
}: {
  mainClass: string | null | undefined;
  profiles: ProfessionProfile[];
  value?: string;
  preserved?: { profileId?: string; className: string } | null;
  id?: string;
  onBlur?: () => void;
  inputRef?: Ref<HTMLInputElement>;
  onChange: (option: ProfessionOption | null) => void;
  disabled?: boolean;
  "aria-label": string;
}) {
  const options = buildProfessionOptions(mainClass, profiles, preserved);
  const selected = resolveSelectedProfessionOption(options, value, preserved);
  return (
    <Combobox.Root
      items={options}
      value={selected}
      onValueChange={onChange}
      itemToStringLabel={(option) => option.className}
      itemToStringValue={(option) => option.value}
      isItemEqualToValue={(option, current) => option.value === current.value}
      disabled={disabled}
    >
      <Combobox.InputGroup className="relative">
        <Combobox.Input
          id={id}
          ref={inputRef}
          onBlur={onBlur}
          aria-label={ariaLabel}
          placeholder="Выберите профессию"
          className="w-full pr-24 text-base sm:text-sm"
        />
        <span className="absolute inset-y-0 right-1 flex items-center gap-1">
          <Combobox.Clear
            aria-label={`Очистить: ${ariaLabel}`}
            className="action-menu-trigger h-11 w-11"
          >
            <X size={15} aria-hidden="true" />
          </Combobox.Clear>
          <Combobox.Trigger
            aria-label={`Показать варианты: ${ariaLabel}`}
            className="action-menu-trigger h-11 w-11"
          >
            <ChevronDown size={15} aria-hidden="true" />
          </Combobox.Trigger>
        </span>
      </Combobox.InputGroup>
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} className="z-50 outline-none">
          <Combobox.Popup className="max-h-[min(22rem,var(--available-height))] w-[var(--anchor-width)] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg">
            <Combobox.Empty className="px-3 py-3 text-sm text-muted-foreground">
              Профессия не найдена.
            </Combobox.Empty>
            <Combobox.List className="max-h-[min(22rem,var(--available-height))] overflow-y-auto p-1">
              {(option: ProfessionOption) => (
                <Combobox.Item
                  key={option.value}
                  value={option}
                  className="flex min-h-11 cursor-default items-center gap-2 rounded-sm px-2 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                >
                  <Combobox.ItemIndicator className="w-4 shrink-0">
                    <Check size={14} aria-hidden="true" />
                  </Combobox.ItemIndicator>
                  <span className="min-w-0 flex-1 truncate">{option.className}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{option.label}</span>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
