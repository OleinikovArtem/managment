"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** Stable UTC server text hydrates to the browser's local time without a mismatch. */
export function LocalDateTime({ value }: { value: string }) {
  const text = useSyncExternalStore(
    subscribe,
    () => new Date(value).toLocaleString("ru-RU"),
    () => `${new Date(value).toLocaleString("ru-RU", { timeZone: "UTC" })} UTC`,
  );
  return <time dateTime={value}>{text}</time>;
}
