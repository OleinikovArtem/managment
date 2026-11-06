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

type EditRaidPageProps = { params: Promise<{ id: string }> };

export default function EditRaidPage({ params }: EditRaidPageProps) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted/50" />}>
      <EditRaidContent params={params} />
    </Suspense>
  );
}

async function EditRaidContent({ params }: EditRaidPageProps) {
  await io();
  const { id } = await params;
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
  if (raid.lockedAt || raid.lootDrops.some(drop => drop.saleTransactions.length > 0)) {
    return <section className="max-w-2xl"><header className="page-header"><h1>Рейд недоступен для редактирования</h1><p className="mt-3">В рейде уже есть продажи. Состав и количество добычи сохранены в финансовой истории.</p></header><Link href={`/raids/${raid.id}`} className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">К рейду и оставшейся добыче</Link></section>;
  }
  const setup = await getRaidSetup(workspace.partyId);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href={`/raids/${raid.id}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft aria-hidden="true" size={16} />
        К рейду
      </Link>
      <header className="page-header ">

        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Редактирование рейда</h1>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>{raid.name}</CardTitle>
          <CardDescription>
            Отметьте присутствующих и уточните добычу. После первой продажи редактирование будет закрыто.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RaidForm
            members={raid.participants.map((participant) => ({
              id: participant.memberId,
              nickname: participant.nicknameSnapshot,
              status: participant.status,
              className: participant.classSnapshot,
              role: participant.roleSnapshot,
              level: participant.levelSnapshot,
              profiles: setup.members.find((member) => member.id === participant.memberId)?.profiles ?? [],
            }))}
            items={setup.items}
            compositions={setup.compositions.map((composition) => ({ id: composition.id, name: composition.name, focus: composition.focus, slots: composition.members.map(({ memberId, profileId }) => ({ memberId, profileId })) }))}
            raidId={raid.id}
            initialValues={{
              name: raid.name,
              compositionId: raid.compositionId ?? "",
              instanceName: raid.instanceName ?? "",
              occurredAt: raid.occurredAt.toISOString(),
              comment: raid.comment ?? "",
              participants: raid.participants.map(({ memberId, status, profileId }) => ({
                memberId,
                status,
                profileId: profileId ?? undefined,
              })),
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
