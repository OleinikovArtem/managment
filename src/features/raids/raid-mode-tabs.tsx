"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
}

function getView() {
  return new URLSearchParams(window.location.search).get("view");
}

export function RaidModeTabs({
  view,
  calendarHref,
  listHref,
}: {
  view: "calendar" | "list";
  calendarHref: string;
  listHref: string;
}) {
  const urlView = useSyncExternalStore(subscribe, getView, () => view);
  const activeView = urlView === "list" ? "list" : "calendar";
  const tabs = [
    { id: "calendar" as const, label: "Календарь", href: calendarHref },
    { id: "list" as const, label: "Список", href: listHref },
  ];

  return (
    <div
      role="tablist"
      aria-label="Режим отображения походов"
      className="flex w-fit gap-1 rounded-lg bg-muted p-1"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          role="tab"
          aria-selected={activeView === tab.id}
          tabIndex={activeView === tab.id ? 0 : -1}
          href={tab.href}
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            const elements = Array.from(
              event.currentTarget
                .closest('[role="tablist"]')
                ?.querySelectorAll<HTMLAnchorElement>('[role="tab"]') ?? [],
            );
            if (!elements.length) return;
            event.preventDefault();
            const index = elements.indexOf(event.currentTarget);
            const next =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? elements.length - 1
                  : (index + (event.key === "ArrowRight" ? 1 : -1) + elements.length) %
                    elements.length;
            elements[next]?.focus();
          }}
          className={`inline-flex min-h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeView === tab.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
