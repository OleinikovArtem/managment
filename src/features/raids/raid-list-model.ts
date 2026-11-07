export type RaidListRow = {
  id: string;
  name: string;
  instanceName: string | null;
  occurredAt: string;
  present: number;
  drops: number;
};

export type RaidPeriod = "today" | "yesterday" | "week" | "month" | "older";
export type RaidGroup = { key: string; label: string; raids: RaidListRow[] };

const DAY_MS = 86_400_000;
const MONTHS = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

function calendarParts(date: Date, timeZone?: string) {
  if (!timeZone) return { year: date.getFullYear(), month: date.getMonth(), day: date.getDate() };
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value) - 1,
    day: Number(parts.find((part) => part.type === "day")?.value),
  };
}

function localDayNumber(date: Date, timeZone?: string) {
  const { year, month, day } = calendarParts(date, timeZone);
  return Math.floor(Date.UTC(year, month, day) / DAY_MS);
}

function olderMonthLabel(date: Date, timeZone?: string) {
  const { year, month } = calendarParts(date, timeZone);
  const label = `${MONTHS[month]} ${year}`;
  return label[0].toLocaleUpperCase("ru-RU") + label.slice(1);
}

export function getRaidPeriod(
  dateValue: string,
  now = new Date(),
  timeZone?: string,
): RaidPeriod | "upcoming" {
  const date = new Date(dateValue);
  const daysAgo = localDayNumber(now, timeZone) - localDayNumber(date, timeZone);
  if (daysAgo < 0) return "upcoming";
  if (daysAgo === 0) return "today";
  if (daysAgo === 1) return "yesterday";
  if (daysAgo <= 7) return "week";
  if (daysAgo <= 30) return "month";
  return "older";
}

export function groupRaids(raids: RaidListRow[], now = new Date(), timeZone?: string): RaidGroup[] {
  const groups = new Map<string, RaidGroup>();
  const sorted = [...raids].toSorted((left, right) =>
    right.occurredAt.localeCompare(left.occurredAt),
  );
  for (const raid of sorted) {
    const date = new Date(raid.occurredAt);
    const period = getRaidPeriod(raid.occurredAt, now, timeZone);
    const calendarDate = calendarParts(date, timeZone);
    const key = period === "older" ? `older-${calendarDate.year}-${calendarDate.month}` : period;
    const label =
      period === "older"
        ? olderMonthLabel(date, timeZone)
        : period === "upcoming"
          ? "Предстоящие"
          : period === "today"
            ? "Сегодня"
            : period === "yesterday"
              ? "Вчера"
              : period === "week"
                ? "Последние 7 дней"
                : "Последние 30 дней";
    const group = groups.get(key);
    if (group) group.raids.push(raid);
    else groups.set(key, { key, label, raids: [raid] });
  }
  return [...groups.values()];
}

export function paginateRaidGroups(groups: RaidGroup[], pageSize: number): RaidGroup[][] {
  const pages: RaidGroup[][] = [];
  let currentPage: RaidGroup[] = [];
  let currentSize = 0;
  const flush = () => {
    if (currentPage.length === 0) return;
    pages.push(currentPage);
    currentPage = [];
    currentSize = 0;
  };

  for (const group of groups) {
    if (group.raids.length > pageSize) {
      flush();
      for (let offset = 0; offset < group.raids.length; offset += pageSize) {
        const chunk = group.raids.slice(offset, offset + pageSize);
        pages.push([
          {
            ...group,
            key: `${group.key}-part-${Math.floor(offset / pageSize) + 1}`,
            raids: chunk,
          },
        ]);
      }
      continue;
    }
    if (currentSize + group.raids.length > pageSize) flush();
    currentPage.push(group);
    currentSize += group.raids.length;
  }
  flush();
  return pages;
}
