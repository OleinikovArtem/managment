"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ru } from "date-fns/locale";

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
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours ?? 0),
    Number(minutes ?? 0),
  );
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  )
    return null;
  if (withTime && (Number(hours) > 23 || Number(minutes) > 59)) return null;
  return withTime
    ? `${year}-${month}-${day}T${pad(hours)}:${pad(minutes)}`
    : `${year}-${month}-${day}`;
}

type Props = Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: string;
  onChange: (value: string) => void;
  withTime?: boolean;
};

export function DateInput({ value, onChange, withTime = false, ...props }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const errorId = useId();
  const [draft, setDraft] = useState(() => dateToDisplay(value));
  const [error, setError] = useState<string | null>(null);
  const [lastEmitted, setLastEmitted] = useState(value);
  const [previousValue, setPreviousValue] = useState(value);
  if (value !== previousValue) {
    setPreviousValue(value);
    if (value !== lastEmitted) {
      setLastEmitted(value);
      setDraft(dateToDisplay(value));
      setError(null);
    }
  }
  useEffect(() => {
    inputRef.current?.setCustomValidity(error ?? "");
  }, [error]);

  function commit(next: string) {
    const normalized = displayToValue(next, withTime);
    if (normalized) {
      setLastEmitted(normalized);
      onChange(normalized);
      setDraft(dateToDisplay(normalized));
      setError(null);
      inputRef.current?.setCustomValidity("");
      if (inputRef.current) inputRef.current.value = dateToDisplay(normalized);
    } else if (!next.trim()) {
      setLastEmitted("");
      onChange("");
      setDraft("");
      setError(null);
      inputRef.current?.setCustomValidity("");
      if (inputRef.current) inputRef.current.value = "";
    } else {
      const message = withTime
        ? "Введите дату и время: ДД.ММ.ГГГГ ЧЧ:ММ."
        : "Введите дату: ДД.ММ.ГГГГ.";
      setError(message);
      inputRef.current?.setCustomValidity(message);
      setLastEmitted("");
      onChange("");
    }
  }

  return (
    <div>
      <div className="relative">
        <CalendarDays
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          {...props}
          ref={inputRef}
          type="text"
          value={draft}
          inputMode="numeric"
          placeholder={withTime ? "ДД.ММ.ГГГГ ЧЧ:ММ" : "ДД.ММ.ГГГГ"}
          aria-invalid={Boolean(error) || props["aria-invalid"]}
          aria-describedby={
            [props["aria-describedby"], error ? errorId : null].filter(Boolean).join(" ") ||
            undefined
          }
          className={`pl-9 pr-12 ${props.className ?? ""}`}
          onChange={(event) => {
            setDraft(event.target.value);
            setError(null);
            event.currentTarget.setCustomValidity("");
          }}
          onBlur={(event) => {
            commit(event.target.value);
            props.onBlur?.(event);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              commit(event.currentTarget.value);
              if (event.currentTarget.validationMessage) event.preventDefault();
            }
            props.onKeyDown?.(event);
          }}
        />
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger
            render={<Button type="button" variant="ghost" size="icon" />}
            className="absolute right-0 top-0 min-h-10"
            aria-label="Выбрать дату"
            disabled={props.disabled}
          >
            <CalendarDays aria-hidden="true" />
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              locale={ru}
              selected={value ? new Date(`${value.slice(0, 10)}T12:00:00`) : undefined}
              defaultMonth={value ? new Date(`${value.slice(0, 10)}T12:00:00`) : undefined}
              className="[--cell-size:2.75rem]"
              onSelect={(date) => {
                if (!date) return;
                const next = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}${withTime ? `T${value.split("T")[1] || "00:00"}` : ""}`;
                setLastEmitted(next);
                onChange(next);
                setDraft(dateToDisplay(next));
                setError(null);
                inputRef.current?.setCustomValidity("");
                setCalendarOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
