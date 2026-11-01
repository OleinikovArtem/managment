export function toLocalDateTimeInput(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function localDateTimeToUtc(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || toLocalDateTimeInput(date) !== value) {
    return null;
  }

  for (let minuteOffset = -24 * 60; minuteOffset <= 24 * 60; minuteOffset += 1) {
    if (
      minuteOffset !== 0 &&
      toLocalDateTimeInput(new Date(date.getTime() + minuteOffset * 60_000)) === value
    ) {
      return null;
    }
  }

  return date.toISOString();
}
