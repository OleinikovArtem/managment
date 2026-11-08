import { Suspense } from "react";
import { notFound } from "next/navigation";
import { io } from "next/cache";
import { requirePartyPageAccess } from "@/server/auth/party-access";
import { getRaid, RaidNotFoundError } from "@/server/services/raid-service";
import { RaidDetailView } from "@/features/raids/raid-detail-view";
import { safeRaidReturnTo } from "@/features/raids/raid-navigation";

type RaidDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function RaidDetailPage({ params, searchParams }: RaidDetailPageProps) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted/50" />}>
      <RaidDetailContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function RaidDetailContent({ params, searchParams }: RaidDetailPageProps) {
  await io();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const returnTo = safeRaidReturnTo(query.returnTo);
  const workspace = await requirePartyPageAccess();

  let raid;
  try {
    raid = await getRaid(workspace.partyId, id);
  } catch (error) {
    if (error instanceof RaidNotFoundError) {
      notFound();
    }
    throw error;
  }

  return (
    <RaidDetailView
      raid={raid}
      partyName={workspace.partyName}
      canManage={workspace.canManage}
      returnTo={returnTo}
    />
  );
}
