import type { Ref } from "react";
import { GameIcon } from "@/components/ui/game-icon";
import { ProfessionSelect } from "@/features/members/profession-select";

export function ClassSelect({
  label,
  id,
  value,
  disabled,
  onChange,
  onBlur,
  inputRef,
}: {
  id: string;
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
  inputRef?: Ref<HTMLInputElement>;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <GameIcon kind="class" name={value || "Не выбран"} size="sm" />
        <ProfessionSelect
          id={id}
          aria-label={label}
          mainClass={value || null}
          profiles={[]}
          value={value ? "main" : undefined}
          disabled={disabled}
          onBlur={onBlur}
          inputRef={inputRef}
          onChange={(option) => onChange(option?.className ?? "")}
        />
      </div>
    </div>
  );
}
