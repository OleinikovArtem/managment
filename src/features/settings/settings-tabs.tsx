"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

const tabs = [
  { id: "group", label: "Группа" },
  { id: "telegram", label: "Telegram" },
  { id: "reset", label: "Reset" },
] as const;

export function SettingsTabs({
  group,
  telegram,
  reset,
}: {
  group: ReactNode;
  telegram: ReactNode;
  reset: ReactNode;
}) {
  const searchParams = useSearchParams();
  const requested = searchParams.get("tab");
  const active = tabs.find((tab) => tab.id === requested)?.id ?? "group";

  return (
    <>
      <nav className="section-tabs" aria-label="Разделы настроек">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={`/settings?tab=${tab.id}`}
            aria-current={active === tab.id ? "page" : undefined}
            onClick={() => {
              if (active === "reset" && tab.id !== "reset") {
                window.dispatchEvent(new Event("settings-reset-exit"));
              }
            }}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      <div hidden={active !== "group"} aria-labelledby="settings-group-heading">
        {group}
      </div>
      <div hidden={active !== "telegram"} aria-labelledby="settings-telegram-heading">
        {telegram}
      </div>
      <div hidden={active !== "reset"} aria-labelledby="settings-reset-heading">
        {reset}
      </div>
    </>
  );
}
