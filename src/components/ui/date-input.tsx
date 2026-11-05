"use client";

import { useRef } from "react";
import { CalendarDays } from "lucide-react";
import { Input } from "@/components/ui/input";

function pad(value: string) {
  return value.padStart(2, "0");
}

function dateToDisplay(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!match) return "";
  const [, year, month, day, hours, minutes] = match;
  return `${day}.${month}.${year}${hours ? ` ${hours}:${minutes}` : ""}`;
}

function displayToValue(display: string, withTime: boolean) {
  const match = withTime
    ? display.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/)
    : display.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return null;
  const [, day, month, year, hours, minutes] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hours ?? 0), Number(minutes ?? 0));
  if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) return null;
  if (withTime && (Number(hours) > 23 || Number(minutes) > 59)) return null;
  return withTime ? `${year}-${month}-${day}T${pad(hours)}:${pad(minutes)}` : `${year}-${month}-${day}`;
}

type Props = Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: string;
  onChange: (value: string) => void;
  withTime?: boolean;
};

export function DateInput({ value, onChange, withTime = false, ...props }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function commit(next: string) {
    const normalized = displayToValue(next, withTime);
    if (normalized) {
      onChange(normalized);
      if (inputRef.current) inputRef.current.value = dateToDisplay(normalized);
    } else if (!next.trim()) {
      onChange("");
      if (inputRef.current) inputRef.current.value = "";
    } else if (inputRef.current) {
      inputRef.current.value = dateToDisplay(value);
    }
  }

  return <div className="relative"><CalendarDays aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input {...props} ref={inputRef} type="text" defaultValue={dateToDisplay(value)} inputMode="numeric" placeholder={withTime ? "ДД.ММ.ГГГГ ЧЧ:ММ" : "ДД.ММ.ГГГГ"} className={`pl-9 ${props.className ?? ""}`} onBlur={(event) => { commit(event.target.value); props.onBlur?.(event); }} onKeyDown={(event) => { if (event.key === "Enter") commit(event.currentTarget.value); }} /> </div>;
}
