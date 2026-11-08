import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Clock3 } from "lucide-react";
import { calendarDate, calendarTime, type CalendarWarning } from "./month-calendar-model";
export function CalendarWarnings({
  warnings,
  now,
  onDay,
}: {
  warnings: CalendarWarning[];
  now: number;
  onDay: (day: string) => void;
}) {
  const active = warnings.filter((w) => Date.parse(w.deadline) > now);
  if (!active.length) return null;
  return (
    <Alert aria-label="Незакрытые инстансы">
      <Clock3 />
      <AlertTitle>До отката меньше 24 часов · {active.length} инстанса</AlertTitle>
      <AlertDescription>
        <div className="grid w-full gap-3 sm:grid-cols-2">
          {active.map((w) => {
            const minutes = Math.max(0, Math.ceil((Date.parse(w.deadline) - now) / 60000));
            return (
              <details key={w.instanceId} className="min-w-0">
                <summary className="cursor-pointer text-sm font-medium text-foreground">
                  {w.name} · {Math.floor(minutes / 60)} ч {minutes % 60} мин
                </summary>
                <p className="mt-1 text-xs">
                  До {calendarDate(w.deadline).split("-").reverse().join(".")}{" "}
                  {calendarTime(w.deadline)} · Europe/Kyiv
                </p>
                <p className="mt-1 break-words text-sm">
                  Не ходили с пати: {w.missing.map((m) => m.nickname).join(", ")}
                </p>
                <Button
                  variant="link"
                  className="min-h-11 px-0"
                  onClick={() => onDay(calendarDate(w.deadline))}
                >
                  К дню отката
                </Button>
              </details>
            );
          })}
        </div>
        <p className="mt-2 text-xs">
          Все активные персонажи группы. Самостоятельные походы вне пати не учитываются.
        </p>
      </AlertDescription>
    </Alert>
  );
}
