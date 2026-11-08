import type { InstanceOption } from "@/features/instances/catalog-schema";

export const CALENDAR_TIMEZONE = "Europe/Kyiv";
export const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
export function calendarDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CALENDAR_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
export function validCalendarDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T12:00:00Z`)) &&
    new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
  );
}
export function calendarMonth(value: unknown, now: Date) {
  return typeof value === "string" && /^(?:19|20|21)\d{2}-(?:0[1-9]|1[0-2])$/.test(value)
    ? value
    : calendarDate(now).slice(0, 7);
}
export function addCalendarDays(day: string, amount: number) {
  return new Date(Date.parse(`${day}T12:00:00Z`) + amount * 86400000).toISOString().slice(0, 10);
}
export function shiftCalendarMonth(month: string, amount: number) {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number - 1 + amount, 1, 12)).toISOString().slice(0, 7);
}
export function monthDates(month: string) {
  const first = `${month}-01`;
  const offset = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
  const end = addCalendarDays(`${shiftCalendarMonth(month, 1)}-01`, -1);
  const count = Math.ceil((offset + Number(end.slice(8))) / 7) * 7;
  const start = addCalendarDays(first, -offset);
  return Array.from({ length: count }, (_, i) => addCalendarDays(start, i));
}
export function dayTitle(day: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long",
  }).format(new Date(`${day}T12:00:00Z`));
}
export function monthTitle(month: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(new Date(`${month}-01T12:00:00Z`));
}
export function calendarTime(instant: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: CALENDAR_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(instant));
}
type CalendarPerson = { memberId: string; nickname: string };
export type MonthEvent = {
  id: string;
  kind: "reset" | "raid";
  date: string;
  occurredAt: string;
  instanceId: string | null;
  instanceIds?: string[];
  name: string;
  participants: CalendarPerson[];
  raidId?: string;
  unknownInstance?: boolean;
};
export type CalendarWarning = {
  instanceId: string;
  name: string;
  deadline: string;
  missing: CalendarPerson[];
};
export type MonthCalendarData = {
  month: string;
  today: string;
  serverNow: string;
  days: string[];
  events: MonthEvent[];
  warnings: CalendarWarning[];
  nextUpdateAt: string | null;
  members: { id: string; nickname: string }[];
  instanceOptions: InstanceOption[];
  canManage: boolean;
  ruleErrors: string[];
};
export function filterMonthEvents(events: MonthEvent[], instance: string, member: string) {
  return events.filter(
    (e) =>
      (!instance || e.instanceId === instance || Boolean(e.instanceIds?.includes(instance))) &&
      (!member || e.kind === "reset" || e.participants.some((p) => p.memberId === member)),
  );
}
