import Link from "next/link";
import { Suspense } from "react";
import { io } from "next/cache";
import { RaidList } from "@/features/raids/raid-list";
import { RaidListSkeleton } from "@/components/ui/page-skeleton";
import { requirePartyPageAccess } from "@/server/auth/party-access";
import { listRaids } from "@/server/services/raid-service";

export default function RaidsPage() {
  return (
    <div className="space-y-5">
      <header className="page-header flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1>Рейды</h1>
          <p className="mt-2">Состав, добыча и продажи каждого выхода группы.</p>
        </div>
        <Suspense fallback={<div className="h-10 w-28 animate-pulse rounded-md bg-muted" />}>
          <NewRaidAction />
        </Suspense>
      </header>
      <Suspense fallback={<RaidListSkeleton />}>
        <RaidsContent />
      </Suspense>
    </div>
  );
}

async function NewRaidAction() {
  const workspace = await requirePartyPageAccess();
  if (!workspace.canManage) return null;
  return (
    <Link
      href="/raids/new"
      className="inline-flex min-h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
    >
      Новый рейд
    </Link>
  );
}

async function RaidsContent() {
  await io();
  const workspace = await requirePartyPageAccess();
  const raids = await listRaids(workspace.partyId);
  return (
    <RaidList
      raids={raids.map((raid) => ({
        id: raid.id,
        name: raid.name,
        instanceName: raid.instanceName,
        occurredAt: raid.occurredAt.toISOString(),
        present: raid.participants.filter((participant) => participant.status === "PRESENT").length,
        drops: raid.lootDrops.length,
      }))}
    />
  );
}
