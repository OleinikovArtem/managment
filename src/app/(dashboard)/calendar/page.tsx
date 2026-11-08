import { Suspense } from "react";
import { io } from "next/cache";
import { requirePartyPageAccess } from "@/server/auth/party-access";
import { readMonthCalendar } from "@/server/repositories/month-calendar-repository";
import { CalendarView } from "@/features/calendar/calendar-view";
import { CalendarSkeleton } from "@/features/calendar/calendar-skeleton";
export default function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <div className="space-y-6">
      <header className="page-header">
        <h1>Календарь инстансов</h1>
        <p className="mt-2">Откаты инстансов и история походов вашей группы.</p>
      </header>
      <Suspense fallback={<CalendarSkeleton />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
async function Content({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await io();
  const access = await requirePartyPageAccess();
  const params = await searchParams;
  const data = await readMonthCalendar(access.partyId, params.month);
  return (
    <CalendarView
      key={`${access.partyId}:${data.month}`}
      data={{ ...data, canManage: access.canManage }}
    />
  );
}
