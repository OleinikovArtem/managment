import Link from "next/link";
import { Suspense } from "react";
import { io } from "next/cache";
import { redirect } from "next/navigation";
import { CalendarView } from "@/features/calendar/calendar-view";
import { CalendarSkeleton } from "@/features/calendar/calendar-skeleton";
import type { InstanceOption } from "@/features/instances/catalog-schema";
import type { RaidListRow } from "@/features/raids/raid-list-model";
import { RaidList } from "@/features/raids/raid-list";
import { requirePartyPageAccess } from "@/server/auth/party-access";
import { listRaids } from "@/server/services/raid-service";
import { readMonthCalendar } from "@/server/repositories/month-calendar-repository";
import { Button } from "@/components/ui/button";
import { RaidModeTabs } from "@/features/raids/raid-mode-tabs";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function RaidsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="space-y-5">
      <header className="page-header flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1>Походы</h1>
          <p className="mt-2">История рейдов группы, календарь и откаты инстансов.</p>
        </div>
        <Suspense fallback={<div className="h-10 w-28 animate-pulse rounded-md bg-muted" />}>
          <NewRaidAction searchParams={searchParams} />
        </Suspense>
      </header>
      <Suspense fallback={<div className="h-11 animate-pulse rounded-md bg-muted" />}>
        <ModeTabs searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<CalendarSkeleton />}>
        <RaidsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function NewRaidAction({ searchParams }: { searchParams: SearchParams }) {
  const workspace = await requirePartyPageAccess();
  if (!workspace.canManage) return null;
  const params = await searchParams;
  const view = params.view === "list" ? "list" : "calendar";
  const query = new URLSearchParams();
  query.set("view", view);
  const keys = ["q", "period", "page", "month", "day", "instance", "member", "resets"];
  for (const key of keys) {
    if (typeof params[key] === "string") query.set(key, params[key]);
  }
  query.set("returnTo", `/raids?${query.toString()}`);
  return (
    <Button nativeButton={false} render={<Link href={`/raids/new?${query}`} />}>
      Записать поход
    </Button>
  );
}

async function ModeTabs({ searchParams }: { searchParams: SearchParams }) {
  await io();
  const params = await searchParams;
  const requested = typeof params.view === "string" ? params.view : "calendar";
  const view = requested === "list" ? "list" : "calendar";
  const url = (next: "calendar" | "list") => {
    const query = new URLSearchParams();
    for (const key of ["q", "period", "page", "month", "day", "instance", "member", "resets"]) {
      const value = params[key];
      if (typeof value === "string") query.set(key, value);
    }
    query.set("view", next);
    return `/raids?${query}`;
  };
  if (requested !== view || typeof params.view !== "string") redirect(url(view));
  return <RaidModeTabs view={view} calendarHref={url("calendar")} listHref={url("list")} />;
}

async function RaidsContent({ searchParams }: { searchParams: SearchParams }) {
  await io();
  const [workspace, params] = await Promise.all([requirePartyPageAccess(), searchParams]);
  const view = params.view === "list" ? "list" : "calendar";
  const [calendar, raidRecords] = await Promise.all([
    readMonthCalendar(workspace.partyId, params.month),
    listRaids(workspace.partyId),
  ]);
  const raids: RaidListRow[] = raidRecords.map((raid) => ({
    id: raid.id,
    instanceId: raid.instanceId,
    name: raid.name,
    instanceName: raid.instanceName,
    occurredAt: raid.occurredAt.toISOString(),
    present: raid.participants.filter((participant) => participant.status === "PRESENT").length,
    drops: raid.lootDrops.length,
  }));
  const fromRaids: InstanceOption[] = raidRecords.flatMap((raid) =>
    raid.instanceId
      ? [{
          id: raid.instanceId,
          name: raid.instanceName || "Инстанс",
          displayName: raid.instanceName || "Инстанс",
          aliases: [],
          source: "raid",
          partyId: workspace.partyId,
          isActive: true,
        }]
      : [],
  );
  const instancesById = new Map(calendar.instanceOptions.map((row) => [row.id, row]));
  for (const instance of fromRaids) {
    if (!instancesById.has(instance.id)) instancesById.set(instance.id, instance);
  }
  const instances = [...instancesById.values()];
  return view === "list" ? (
    <RaidList raids={raids} instances={instances} />
  ) : (
    <CalendarView
      key={`${workspace.partyId}:${calendar.month}`}
      data={{ ...calendar, canManage: workspace.canManage }}
      instances={instances}
    />
  );
}
