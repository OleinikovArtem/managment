import { CalendarError, type CalendarRuleData } from "@/features/calendar/calendar-schema";

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(timezone: string) {
  if (!formatters.has(timezone))
    formatters.set(
      timezone,
      new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }),
    );
  return formatters.get(timezone)!;
}
function zonedParts(date: Date, timezone: string) {
  const parts = Object.fromEntries(
    formatter(timezone)
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
// Enumerate possible offsets around the requested wall time. Reject gaps and folds;
// adding 24h to UTC would drift across daylight-saving transitions.
export function wallTimeToUtc(wall: string, timezone: string): Date {
  const naive = Date.parse(`${wall}:00Z`);
  if (!Number.isFinite(naive)) throw new CalendarError("Некорректное время расписания.");
  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6) {
    const sample = new Date(naive + hours * 3600000);
    offsets.add(Date.parse(`${zonedParts(sample, timezone)}:00Z`) - sample.getTime());
  }
  const matches = [...offsets]
    .map((offset) => new Date(naive - offset))
    .filter((d) => zonedParts(d, timezone) === wall);
  if (matches.length !== 1)
    throw new CalendarError("Время отката неоднозначно или не существует при переходе часов.");
  return matches[0];
}
export function resetPeriod(rule: CalendarRuleData, at: Date) {
  if (at < rule.effectiveFrom)
    throw new CalendarError("На эту дату ещё нет действующего расписания.");
  if (
    !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(rule.localTime) ||
    !["daily", "weekly"].includes(rule.type) ||
    (rule.type === "weekly" && !rule.isoWeekdays.length)
  )
    throw new CalendarError("Расписание не поддерживается.");
  const localDay = zonedParts(at, rule.timezone).slice(0, 10);
  const day = Date.parse(`${localDay}T12:00:00Z`);
  const boundaries: Date[] = [];
  for (let offset = -8; offset <= 15; offset++) {
    const date = new Date(day + offset * 86400000);
    const weekday = date.getUTCDay() || 7;
    if (rule.type === "weekly" && !rule.isoWeekdays.includes(weekday)) continue;
    boundaries.push(
      wallTimeToUtc(`${date.toISOString().slice(0, 10)}T${rule.localTime}`, rule.timezone),
    );
  }
  const start = boundaries.filter((d) => d <= at).at(-1);
  const next = boundaries.filter((d) => d > at);
  if (!start || !next[0]) throw new CalendarError("Не удалось определить период отката.");
  return {
    start,
    end: next[0],
  };
}
