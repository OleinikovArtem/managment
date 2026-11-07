"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

export function LocalDateTimeDisplay({ value, className }: { value: string; className?: string }) {
  const formatted = useSyncExternalStore(
    subscribe,
    () => {
      const date = new Date(value);
      return `${date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })} ${date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
    },
    () => "Локальное время",
  );

  return (
    <time className={className} dateTime={value}>
      {formatted}
    </time>
  );
}
