import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { io } from "next/cache";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RaidForm } from "@/features/raids/raid-form";
import { requirePartyPageAccess } from "@/server/auth/party-access";
import { getRaid, getRaidSetup, RaidNotFoundError } from "@/server/services/raid-service";
import { safeRaidReturnTo, raidHrefWithReturnTo } from "@/features/raids/raid-navigation";

type EditRaidPageProps = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function EditRaidPage({ params, searchParams }: EditRaidPageProps) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted/50" />}>
      <EditRaidContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function EditRaidContent({ params, searchParams }: EditRaidPageProps) {
  await io();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const returnTo = safeRaidReturnTo(query.returnTo);
  const detailHref = raidHrefWithReturnTo(`/raids/${id}`, returnTo);
  const workspace = await requirePartyPageAccess();
  if (!workspace.canManage) redirect("/dashboard");
  let raid;
  try {
    raid = await getRaid(workspace.partyId, id);
  } catch (error) {
    if (error instanceof RaidNotFoundError) {
      notFound();
    }
    throw error;
  }
  if (raid.lockedAt || raid.lootDrops.some((drop) => drop.saleTransactions.length > 0)) {
    return (
      <section className="max-w-2xl">
        <header className="page-header">
          <h1>Рейд недоступен для редактирования</h1>
          <p className="mt-3">
            В рейде уже есть продажи. Состав и количество добычи сохранены в финансовой истории.
          </p>
        </header>
        <Link
          href={detailHref}
          className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
        >
          К рейду и оставшейся добыче
        </Link>
      </section>
    );
  }
  const setup = await getRaidSetup(workspace.partyId);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href={detailHref}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" size={16} />К рейду
      </Link>
      <header className="page-header ">
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Редактирование рейда</h1>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>{raid.name}</CardTitle>
          <CardDescription>
            Здесь можно изменить состав рейда, добавить предмет добычи или удалить ошибочную запись.
            После первой продажи редактирование будет закрыто, чтобы сохранить финансовую историю.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RaidForm
            returnTo={returnTo}
            members={raid.participants.map((participant) => ({
              id: participant.memberId,
              nickname: participant.nicknameSnapshot,
              status: participant.status,
              className: participant.member.className,
              role: participant.member.role,
              level: participant.member.level,
              profiles: [
                ...(setup.members.find((member) => member.id === participant.memberId)?.profiles ??
                  []),
                ...(participant.profileId &&
                !setup.members
                  .find((member) => member.id === participant.memberId)
                  ?.profiles.some((profile) => profile.id === participant.profileId)
                  ? [
                      {
                        id: participant.profileId,
                        name: participant.profileSnapshot ?? "Исторический профиль",
                        className: participant.classSnapshot ?? "Исторический класс",
                        role: participant.roleSnapshot,
                        level: participant.levelSnapshot,
                      },
                    ]
                  : []),
              ],
            }))}
            items={[
              ...new Map(
                [...setup.items, ...raid.lootDrops.map((drop) => drop.item)].map((item) => [
                  item.id,
                  item,
                ]),
              ).values(),
            ]}
            instances={setup.catalog.instances}
            stages={setup.catalog.stages.available}
            defaultStage={setup.catalog.stages.context}
            historicalStageName={raid.stageNameSnapshot}
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
            raidId={raid.id}
            initialValues={{
              name: raid.name,
              compositionId: raid.compositionId ?? undefined,
              instanceName: raid.instanceName ?? "",
              instanceId: raid.instanceId,
              stageId: raid.stageId,
              stageRevision: raid.stageRevisionSnapshot,
              occurredAt: raid.occurredAt.toISOString(),
              comment: raid.comment ?? "",
              participants: raid.participants.map(
                ({ memberId, status, profileId, classSnapshot }) => {
                  const currentMember = setup.members.find((member) => member.id === memberId);
                  const classOverride =
                    !profileId && classSnapshot && classSnapshot !== currentMember?.className
                      ? classSnapshot
                      : undefined;
                  return {
                    memberId,
                    status,
                    profileId: profileId ?? undefined,
                    classOverride,
                  };
                },
              ),
              lootDrops: raid.lootDrops.map(({ id, itemId, quantity, comment }) => ({
                id,
                itemId,
                quantity,
                comment: comment ?? "",
              })),
            }}
            submitLabel="Сохранить изменения"
          />
        </CardContent>
      </Card>
    </div>
  );
}
