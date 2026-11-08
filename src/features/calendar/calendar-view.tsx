"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { SidePanel } from "@/components/ui/side-panel";
import { InstanceSelect } from "@/features/instances/instance-select";
import { MemberSelect } from "@/features/members/member-select";
import { MonthCalendar } from "./month-calendar";
import { CalendarDayDetails } from "./calendar-day-details";
import { WeeklyResetReference } from "./weekly-reset-reference";
import { CalendarWarnings } from "./calendar-warnings";
import type { InstanceOption } from "@/features/instances/catalog-schema";
import {
  calendarDate,
  validCalendarDate,
  shiftCalendarMonth,
  monthTitle,
  filterMonthEvents,
  dayTitle,
  type MonthCalendarData,
} from "./month-calendar-model";

export function CalendarView({
  data,
  instances,
}: {
  data: MonthCalendarData;
  instances: InstanceOption[];
}) {
  const router = useRouter(),
    params = useSearchParams();
  const fallback = data.days.includes(data.today) ? data.today : `${data.month}-01`;
  const [selected, setSelected] = useState(() =>
    validCalendarDate(params.get("day") ?? "") && data.days.includes(params.get("day")!)
      ? params.get("day")!
      : fallback,
  );
  const [filters, setFilters] = useState(() => ({
    instance: params.get("instance") ?? "",
    member: params.get("member") ?? "",
  }));
  const [clock, setClock] = useState(Date.parse(data.serverNow));
  const [refreshing, startRefresh] = useTransition();
  const [showResets, setShowResets] = useState(() => params.get("resets") === "1");
  const [detailsOpen, setDetailsOpen] = useState(() => Boolean(params.get("day")));
  const dayTrigger = useRef<HTMLElement | null>(null);
  const now = Math.max(clock, Date.parse(data.serverNow));
  useEffect(() => {
    const restore = () => {
      const query = new URLSearchParams(window.location.search);
      const day = query.get("day") ?? fallback;
      setSelected(validCalendarDate(day) && data.days.includes(day) ? day : fallback);
      setDetailsOpen(Boolean(query.get("day")));
      setShowResets(query.get("resets") === "1");
      setFilters({ instance: query.get("instance") ?? "", member: query.get("member") ?? "" });
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [data.days, fallback]);
  useEffect(() => {
    const received = Date.now(),
      base = Date.parse(data.serverNow);
    let ticks = 0;
    const timer = window.setInterval(() => {
      setClock(base + Date.now() - received);
      if (!document.hidden && ++ticks % 2 === 0) router.refresh();
    }, 30000);
    const refresh = () => {
      if (!document.hidden) router.refresh();
    };
    window.addEventListener("focus", refresh);
    const timeout = data.nextUpdateAt
      ? window.setTimeout(refresh, Math.max(0, Date.parse(data.nextUpdateAt) - base + 250))
      : null;
    return () => {
      clearInterval(timer);
      if (timeout !== null) clearTimeout(timeout);
      window.removeEventListener("focus", refresh);
    };
  }, [data.serverNow, data.nextUpdateAt, router]);
  function url(changes: Record<string, string>) {
    const query = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) query.set(key, value);
      else query.delete(key);
    }
    query.set("view", "calendar");
    return `/raids${query.size ? `?${query}` : ""}`;
  }
  function changeFilter(key: "instance" | "member", value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
    window.history.replaceState(null, "", url({ [key]: value }));
  }
  function navigate(month: string, day = "") {
    startRefresh(() => router.push(url({ month, day }), { scroll: false }));
  }
  function select(day: string) {
    dayTrigger.current = document.activeElement as HTMLElement;
    setSelected(day);
    setDetailsOpen(true);
    window.history.pushState(null, "", url({ day }));
  }
  function goToDay(day: string) {
    if (data.days.includes(day)) select(day);
    else navigate(day.slice(0, 7), day);
  }
  const events = filterMonthEvents(data.events, filters.instance, filters.member);
  const dayEvents = events.filter((event) => event.date === selected);
  return (
    <div className="space-y-5" data-ui="calendar">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex w-full min-w-0 flex-wrap items-center gap-1 sm:w-auto">
          <Button
            variant="outline"
            size="icon-lg"
            aria-label="Предыдущий месяц"
            disabled={refreshing}
            onClick={() => navigate(shiftCalendarMonth(data.month, -1))}
          >
            <ChevronLeft />
          </Button>
          <h2
            className="min-w-0 flex-1 px-1 text-center text-base font-semibold capitalize sm:min-w-36 sm:px-2 sm:text-lg"
            aria-live="polite"
          >
            {monthTitle(data.month)}
          </h2>
          <Button
            variant="outline"
            size="icon-lg"
            aria-label="Следующий месяц"
            disabled={refreshing}
            onClick={() => navigate(shiftCalendarMonth(data.month, 1))}
          >
            <ChevronRight />
          </Button>
          <Button
            variant="ghost"
            className="min-h-11"
            disabled={refreshing}
            onClick={() => {
              const today = calendarDate(new Date());
              if (data.month === today.slice(0, 7)) select(today);
              else navigate(today.slice(0, 7), today);
            }}
          >
            Сегодня
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={showResets ? "secondary" : "outline"}
            className="min-h-11"
            aria-pressed={showResets}
            onClick={() => {
              const value = !showResets;
              setShowResets(value);
              window.history.replaceState(null, "", url({ resets: value ? "1" : "" }));
            }}
          >
            {showResets ? "Скрыть откаты" : "Показывать откаты"}
          </Button>
          <WeeklyResetReference />
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label="Обновить календарь"
            disabled={refreshing}
            onClick={() => startRefresh(() => router.refresh())}
          >
            <RotateCw />
          </Button>
        </div>
      </div>
      {data.ruleErrors.length > 0 && (
        <Alert>
          <AlertTitle>Есть неподдержанные расписания</AlertTitle>
          <AlertDescription>
            Проверьте правила: {data.ruleErrors.join(", ")}. Для неоднозначного времени откат не
            выдумывается.
          </AlertDescription>
        </Alert>
      )}
      <CalendarWarnings warnings={data.warnings} now={now} onDay={goToDay} />
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <div>
          <span className="mb-2 block text-xs text-muted-foreground">Инстанс</span>
          <InstanceSelect
            rows={instances}
            value={filters.instance || null}
            onChange={(value) => changeFilter("instance", value ?? "")}
            disabled={refreshing}
            emptyLabel="Все инстансы"
            label="Фильтр инстанса"
          />
        </div>
        <div>
          <span className="mb-2 block text-xs text-muted-foreground">Персонаж в походах</span>
          <MemberSelect
            rows={data.members}
            value={filters.member || null}
            onChange={(value) => changeFilter("member", value ?? "")}
          />
        </div>
        <Button
          variant="ghost"
          className="min-h-11 self-end"
          onClick={() => {
            setFilters({ instance: "", member: "" });
            window.history.replaceState(null, "", url({ instance: "", member: "" }));
          }}
        >
          Сбросить фильтры
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex gap-4">
          {showResets && <span>↻ Откат — справочно, не запись похода</span>}
          <span className="text-emerald-400">● Поход группы</span>
        </div>
        <span>Europe/Kyiv</span>
      </div>
      <div aria-busy={refreshing}>
        <MonthCalendar
          key={data.month}
          month={data.month}
          days={data.days}
          today={data.today}
          selected={selected}
          events={showResets ? events : events.filter((event) => event.kind === "raid")}
          onSelect={select}
          onChangeMonth={(direction) => navigate(shiftCalendarMonth(data.month, direction))}
          canCreate={data.canManage}
          onCreate={(day) => {
            const returnTo = url({});
            router.push(`/raids/new?calendarDate=${day}&returnTo=${encodeURIComponent(returnTo)}`);
          }}
        />
      </div>
      <SidePanel
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) window.history.replaceState(null, "", url({ day: "" }));
        }}
        title={dayTitle(selected)}
        description="Походы группы и откаты выбранного дня · Europe/Kyiv"
        finalFocus={dayTrigger}
      >
        <CalendarDayDetails
          day={selected}
          today={data.today}
          events={dayEvents}
          canManage={data.canManage}
          returnTo={url({})}
        />
      </SidePanel>
    </div>
  );
}
