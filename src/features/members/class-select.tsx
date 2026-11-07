import type { ComponentProps } from "react";
import { GameIcon } from "@/components/ui/game-icon";
import { LINEAGE2_HIGH_FIVE_CLASSES } from "./lineage2-classes";

const kamael = new Set([
  "Doombringer",
  "Male Soul Hound",
  "Female Soul Hound",
  "Trickster",
  "Inspector",
  "Judicator",
]);

export function ClassSelect({
  label,
  id,
  value,
  ...props
}: ComponentProps<"select"> & { id: string; label: string; value: string }) {
  return (
    <div className="min-w-0 space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <GameIcon kind="class" name={value || "Не выбран"} size="sm" />
        <select
          {...props}
          id={id}
          value={value}
          className="min-h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-base sm:text-sm"
        >
          <option value="">Не выбран</option>
          {value && !LINEAGE2_HIGH_FIVE_CLASSES.some((name) => name === value) && (
            <option value={value}>{value}</option>
          )}
          <optgroup label="Классы High Five">
            {LINEAGE2_HIGH_FIVE_CLASSES.filter((name) => !kamael.has(name)).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Kamael">
            {LINEAGE2_HIGH_FIVE_CLASSES.filter((name) => kamael.has(name)).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </optgroup>
        </select>
      </div>
    </div>
  );
}
