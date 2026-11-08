"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  WEEKDAYS,
  addCalendarDays,
  dayTitle,
  monthTitle,
  type MonthEvent,
} from "./month-calendar-model";

export function MonthCalendar({
  month,
  days,
  today,
  selected,
  events,
  onSelect,
  onChangeMonth,
}: {
  month: string;
  days: string[];
  today: string;
  selected: string;
  events: MonthEvent[];
  onSelect: (day: string) => void;
  onChangeMonth: (direction: number) => void;
}) {
  const [focused, setFocused] = useState(days.includes(selected) ? selected : `${month}-01`);
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const byDay = new Map<string, MonthEvent[]>();
  for (const event of events) {
    const list = byDay.get(event.date) ?? [];
    list.push(event);
    byDay.set(event.date, list);
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => Number(b.kind === "raid") - Number(a.kind === "raid"));
  }
  return (
    <div
      role="grid"
      aria-label={`Календарь, ${monthTitle(month)}`}
      className="-mx-3 overflow-hidden rounded-lg border border-border sm:mx-0"
    >
      <div role="row" className="grid grid-cols-7 border-b border-border bg-muted/30">
        {WEEKDAYS.map((day) => (
          <div
            role="columnheader"
            key={day}
            className="py-3 text-center text-xs font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>
      {Array.from({ length: days.length / 7 }, (_, week) => (
        <div role="row" key={week} className="grid grid-cols-7">
          {days.slice(week * 7, week * 7 + 7).map((day) => {
            const dayEvents = byDay.get(day) ?? [];
            const raidInstanceIds = new Set(
              dayEvents.filter((event) => event.kind === "raid").map((event) => event.instanceId),
            );
            const list = dayEvents.filter(
                (event) =>
                  event.kind === "raid" ||
                  !(event.instanceIds ?? [event.instanceId]).some((id) => raidInstanceIds.has(id)),
              ),
              resets = list.filter((e) => e.kind === "reset").length,
              raids = list.filter((e) => e.kind === "raid").length;
            return (
              <div
                role="gridcell"
                key={day}
                aria-selected={selected === day}
                className={`min-w-0 border-b border-r border-border last:border-r-0 ${selected === day ? "bg-accent/60" : day.slice(0, 7) !== month ? "bg-muted/20" : ""}`}
              >
                <Button
                  ref={(node) => {
                    if (node) refs.current.set(day, node);
                    else refs.current.delete(day);
                  }}
                  data-date={day}
                  variant="ghost"
                  tabIndex={focused === day ? 0 : -1}
                  aria-label={`${dayTitle(day)}: ${resets} откатов, ${raids} походов`}
                  aria-current={day === today ? "date" : undefined}
                  style={{ height: "100%" }}
                  className="relative flex min-h-[96px] w-full min-w-0 flex-col items-stretch justify-start gap-1 whitespace-normal rounded-none p-1 text-left font-normal focus-visible:z-10 focus-visible:ring-inset [&>span]:shrink-0 sm:min-h-[144px] sm:p-2"
                  onFocus={() => setFocused(day)}
                  onClick={() => onSelect(day)}
                  onKeyDown={(e) => {
                    let next: string | undefined;
                    if (e.key === "ArrowLeft") next = addCalendarDays(day, -1);
                    if (e.key === "ArrowRight") next = addCalendarDays(day, 1);
                    if (e.key === "ArrowUp") next = addCalendarDays(day, -7);
                    if (e.key === "ArrowDown") next = addCalendarDays(day, 7);
                    if (e.key === "Home") next = days[week * 7];
                    if (e.key === "End") next = days[week * 7 + 6];
                    if (e.key === "PageUp" || e.key === "PageDown") {
                      e.preventDefault();
                      onChangeMonth(e.key === "PageUp" ? -1 : 1);
                      return;
                    }
                    if (next) {
                      e.preventDefault();
                      if (days.includes(next)) {
                        setFocused(next);
                        refs.current.get(next)?.focus();
                      }
                    }
                  }}
                >
                  <span
                    className={`mb-1 inline-flex size-7 items-center justify-center self-start rounded-full text-sm tabular-nums ${day === today ? "bg-foreground font-semibold text-background" : day.slice(0, 7) !== month ? "text-muted-foreground" : "text-foreground"}`}
                  >
                    {Number(day.slice(8))}
                  </span>
                  <span className="flex flex-col gap-1 text-[11px] leading-4 sm:hidden">
                    {raids > 0 && (
                      <span className="font-medium text-emerald-400">{raids} пох.</span>
                    )}
                    {resets > 0 && <span className="text-muted-foreground">{resets} отк.</span>}
                  </span>
                  <span className="hidden min-w-0 flex-col gap-1 sm:flex">
                    {list.slice(0, 3).map((event) => (
                      <span
                        key={event.id}
                        className={`block truncate rounded px-1 py-0.5 text-[11px] leading-4 ${event.kind === "raid" ? "bg-emerald-400/10 text-emerald-300" : "bg-muted/60 text-muted-foreground"}`}
                        title={`${event.kind === "raid" ? "Поход" : "Откат"}: ${event.name}`}
                      >
                        <span aria-hidden="true">{event.kind === "raid" ? "●" : "↻"} </span>
                        {event.kind === "raid" ? "Поход" : "Откат"} · {event.name}
                      </span>
                    ))}
                    {list.length > 3 && (
                      <span className="px-1 text-[11px] text-muted-foreground">
                        Ещё {list.length - 3}
                      </span>
                    )}
                  </span>
                </Button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
