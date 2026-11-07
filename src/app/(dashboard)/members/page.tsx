import { SectionNavigation } from "@/components/layout/section-navigation";
import { Suspense } from "react";
import { io } from "next/cache";
import { MemberManager } from "@/features/members/member-manager";
import { listPartyMembers } from "@/server/repositories/party-member-repository";
import { requirePartyPageAccess } from "@/server/auth/party-access";
import { listPartyMemberProfiles } from "@/server/repositories/member-profile-repository";

export default function MembersPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted/50" />}>
      <MembersContent />
    </Suspense>
  );
}

async function MembersContent() {
  await io();
  const workspace = await requirePartyPageAccess();
  const [records, profiles] = await Promise.all([
    listPartyMembers(workspace.partyId),
    listPartyMemberProfiles(workspace.partyId),
  ]);
  const members = records.map((member) => ({
    id: member.id,
    nickname: member.nickname,
    distributionWeight: member.distributionWeight,
    isActive: member.isActive,
    comment: member.comment,
    className: member.className,
    level: member.level,
    role: member.role,
    profiles: profiles
      .filter((profile) => profile.memberId === member.id)
      .map(({ id, name, className, role, level, note, subclassSlot }) => ({
        id,
        name,
        className,
        role,
        level,
        note,
        subclassSlot,
      })),
    createdAt: member.createdAt.toLocaleDateString("ru-RU"),
  }));

  return (
    <div className="space-y-7">
      <header className="page-header ">
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Участники</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ведите постоянный состав и сохраняйте историю, когда персонаж перестаёт участвовать.
        </p>
      </header>
      <SectionNavigation section="group" active="/members" />
      <MemberManager members={members} canManage={workspace.canManage} />
    </div>
  );
}
