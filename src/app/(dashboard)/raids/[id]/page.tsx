import { Suspense } from "react";
import { notFound } from "next/navigation";
import { io } from "next/cache";
import { requirePartyPageAccess } from "@/server/auth/party-access";
import { getRaid, RaidNotFoundError } from "@/server/services/raid-service";
import { RaidDetailView } from "@/features/raids/raid-detail-view";

type RaidDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default function RaidDetailPage({ params }: RaidDetailPageProps) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted/50" />}>
      <RaidDetailContent params={params} />
    </Suspense>
  );
}

async function RaidDetailContent({ params }: RaidDetailPageProps) {
  await io();
  const { id } = await params;
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
    <RaidDetailView raid={raid} partyName={workspace.partyName} canManage={workspace.canManage} />
  );
}
