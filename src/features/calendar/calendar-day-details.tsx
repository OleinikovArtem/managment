import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { calendarTime, type MonthEvent } from "./month-calendar-model";

export function CalendarDayDetails({
  day,
  today,
  events,
  canManage,
  returnTo,
}: {
  day: string;
  today: string;
  events: MonthEvent[];
  canManage: boolean;
  returnTo: string;
}) {
  const raids = events.filter((e) => e.kind === "raid"),
    resets = events.filter((e) => e.kind === "reset");
  return (
    <section aria-label="Детали дня">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mt-1 text-xs text-muted-foreground">
            Europe/Kyiv · {raids.length} походов · {resets.length} откатов
          </p>
        </div>
        {canManage && day <= today && (
          <Button
            nativeButton={false}
            role="link"
            variant="outline"
            className="min-h-11"
            render={
              <Link
                href={`/raids/new?calendarDate=${day}&returnTo=${encodeURIComponent(returnTo)}`}
              />
            }
          >
            Записать поход
          </Button>
        )}
      </div>
      <div className="grid gap-6">
        <div>
          <h3 className="mb-3 text-sm font-medium">Походы группы</h3>
          {!raids.length && (
            <p className="text-sm text-muted-foreground">
              {day > today
                ? "Будущий день — состоявшихся походов ещё нет."
                : "Походы группы не записаны."}
            </p>
          )}
          <div className="space-y-3">
            {raids.map((event) => (
              <article key={event.id} className="rounded-md bg-muted/30 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/raids/${event.raidId}?returnTo=${encodeURIComponent(returnTo)}`}
                    className="text-sm font-medium underline-offset-4 hover:underline"
                  >
                    {event.name} ↗
                  </Link>
                  <time
                    className="text-xs tabular-nums text-muted-foreground"
                    dateTime={event.occurredAt}
                  >
                    {calendarTime(event.occurredAt)}
                  </time>
                </div>
                {event.unknownInstance && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Инстанс не определён — не влияет на закрытие конкретного инстанса.
                  </p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  Участвовали ({event.participants.length})
                </p>
                <ul className="mt-2 flex flex-wrap gap-2" aria-label={`Участники: ${event.name}`}>
                  {event.participants.map((p) => (
                    <li key={p.memberId}>
                      <Badge variant="secondary" className="max-w-full whitespace-normal break-all">
                        {p.nickname}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-medium">Откаты — справочно</h3>
          {!resets.length && (
            <p className="text-sm text-muted-foreground">На этот день нет настроенных откатов.</p>
          )}
          <ul className="divide-y divide-border">
            {resets.map((event) => (
              <li key={event.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 break-words">{event.name}</span>
                <time
                  dateTime={event.occurredAt}
                  className="shrink-0 tabular-nums text-muted-foreground"
                >
                  {calendarTime(event.occurredAt)}
                </time>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
