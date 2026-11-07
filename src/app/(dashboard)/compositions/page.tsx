import { SectionNavigation } from "@/components/layout/section-navigation";
import { Suspense } from "react";
import { io } from "next/cache";
import { CompositionManager } from "@/features/compositions/composition-manager";
import { listPartyCompositions } from "@/server/repositories/composition-repository";
import { listPartyMembers } from "@/server/repositories/party-member-repository";
import { listPartyMemberProfiles } from "@/server/repositories/member-profile-repository";
import { requirePartyPageAccess } from "@/server/auth/party-access";

export default function CompositionsPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted/50" />}>
      <CompositionsContent />
    </Suspense>
  );
}

async function CompositionsContent() {
  await io();
  const workspace = await requirePartyPageAccess();
  const [records, compositions, profiles] = await Promise.all([
    listPartyMembers(workspace.partyId),
    listPartyCompositions(workspace.partyId),
    listPartyMemberProfiles(workspace.partyId),
  ]);
  const members = records
    .filter((member) => member.isActive)
    .map(({ id, nickname, className, role, level }) => ({
      id,
      nickname,
      className,
      role,
      level,
      profiles: profiles
        .filter((profile) => profile.memberId === id)
        .map(
          ({
            id: profileId,
            name,
            className: profileClass,
            role: profileRole,
            level: profileLevel,
            subclassSlot,
          }) => ({
            id: profileId,
            name,
            className: profileClass,
            role: profileRole,
            level: profileLevel,
            subclassSlot,
          }),
        ),
    }));
  const rows = compositions.map((composition) => ({
    id: composition.id,
    name: composition.name,
    description: composition.description,
    focus: composition.focus,
    members: composition.members.map(({ member, profile }) => ({
      member: {
        id: member.id,
        nickname: member.nickname,
        className: member.className,
        role: member.role,
        level: member.level,
        profiles: members.find((item) => item.id === member.id)?.profiles ?? [],
      },
      profile: profile
        ? {
            id: profile.id,
            name: profile.name,
            className: profile.className,
            role: profile.role,
            level: profile.level,
            subclassSlot: profile.subclassSlot,
          }
        : null,
    })),
  }));
  return (
    <div className="space-y-7">
      <header className="page-header ">
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Составы</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Готовые сетки для melee, mage, арчерских и рейдовых групп. В каждом слоте видно, кто идёт
          и какой 3-й профой.
        </p>
      </header>
      <SectionNavigation section="group" active="/compositions" />
      <CompositionManager compositions={rows} members={members} canManage={workspace.canManage} />
    </div>
  );
}
