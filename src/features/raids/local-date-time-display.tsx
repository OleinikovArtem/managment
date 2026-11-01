"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

export function LocalDateTimeDisplay({ value }: { value: string }) {
  const formatted = useSyncExternalStore(
    subscribe,
    () => new Date(value).toLocaleString("ru-RU"),
    () => "Локальное время",
  );

  return <time dateTime={value}>{formatted}</time>;
}
