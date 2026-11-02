import { Suspense } from "react";
import { io } from "next/cache";
import { MemberManager } from "@/features/members/member-manager";
import { listPartyMembers } from "@/server/repositories/party-member-repository";
import { ensureLocalWorkspace } from "@/server/bootstrap/local-workspace";

export default function MembersPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted/50" />}>
      <MembersContent />
    </Suspense>
  );
}

async function MembersContent() {
  await io();
  const workspace = await ensureLocalWorkspace();
  const records = await listPartyMembers(workspace.partyId);
  const members = records.map((member) => ({
    id: member.id,
    nickname: member.nickname,
    distributionWeight: member.distributionWeight,
    isActive: member.isActive,
    comment: member.comment,
    createdAt: member.createdAt.toLocaleDateString("ru-RU"),
  }));

  return (
    <div className="space-y-7">
      <header>
        <p className="text-sm font-medium text-primary">{workspace.partyName}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Участники</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ведите постоянный состав и сохраняйте историю, когда персонаж перестаёт участвовать.
        </p>
      </header>
      <MemberManager members={members} />
    </div>
  );
}
