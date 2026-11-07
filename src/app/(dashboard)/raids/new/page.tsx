import Link from "next/link";
import { Suspense } from "react";
import { io } from "next/cache";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { RaidForm } from "@/features/raids/raid-form";
import { requirePartyPageAccess } from "@/server/auth/party-access";
import { getRaidSetup } from "@/server/services/raid-service";

export default function NewRaidPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted/50" />}>
      <NewRaidContent />
    </Suspense>
  );
}

async function NewRaidContent() {
  await io();
  const workspace = await requirePartyPageAccess();
  if (!workspace.canManage) redirect("/dashboard");
  const setup = await getRaidSetup(workspace.partyId);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Link
        href="/raids"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" size={16} />К рейдам
      </Link>
      <h1 className="sr-only">Создание рейда</h1>
      <RaidForm
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
