import Link from "next/link";
import { Suspense } from "react";
import { io } from "next/cache";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { RaidForm } from "@/features/raids/raid-form";
import { requirePartyPageAccess } from "@/server/auth/party-access";
import { getRaidSetup } from "@/server/services/raid-service";
import { calendarDate, validCalendarDate } from "@/features/calendar/month-calendar-model";
import { safeRaidReturnTo } from "@/features/raids/raid-navigation";
import { wallTimeToUtc } from "@/server/services/instance-reset-schedule";

export default function NewRaidPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted/50" />}>
      <NewRaidContent searchParams={searchParams} />
    </Suspense>
  );
}

async function NewRaidContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await io();
  const workspace = await requirePartyPageAccess();
  if (!workspace.canManage) redirect("/dashboard");
  const setup = await getRaidSetup(workspace.partyId);
  const params = await searchParams;
  const now = new Date(),
    today = calendarDate(now);
  const day =
    typeof params.calendarDate === "string" &&
    validCalendarDate(params.calendarDate) &&
    params.calendarDate <= today
      ? params.calendarDate
      : null;
  const initialOccurredAt = day
    ? (day === today ? now : wallTimeToUtc(`${day}T12:00`, "Europe/Kyiv")).toISOString()
    : undefined;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Link
        href={safeRaidReturnTo(params.returnTo)}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" size={16} />К рейдам
      </Link>
      <h1 className="sr-only">Создание рейда</h1>
      <RaidForm
        initialOccurredAt={initialOccurredAt}
        returnTo={safeRaidReturnTo(params.returnTo)}
        members={setup.members.map((member) => ({ ...member, status: "PRESENT" as const }))}
        items={setup.items}
        instances={setup.catalog.instances}
        stages={setup.catalog.stages.available}
        defaultStage={setup.catalog.stages.context}
        lastAttendance={setup.lastAttendance}
        compositions={setup.compositions.map((composition) => ({
          id: composition.id,
          name: composition.name,
          focus: composition.focus,
          slots: composition.members.map(({ memberId, profileId, classOverride, profile }) => ({
            memberId,
            profileId,
            classOverride,
            profileClassName: profile?.className ?? null,
          })),
        }))}
        submitLabel="Создать рейд"
      />
    </div>
  );
}
