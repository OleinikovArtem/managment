import Link from "next/link";
import { Suspense } from "react";
import { io } from "next/cache";
import { RaidList } from "@/features/raids/raid-list";
import { ensureLocalWorkspace } from "@/server/bootstrap/local-workspace";
import { listRaids } from "@/server/services/raid-service";

export default function RaidsPage() {
  return <Suspense fallback={<p role="status" className="empty-state">Загрузка рейдов…</p>}><RaidsContent /></Suspense>;
}

async function RaidsContent() {
  await io();
  const workspace = await ensureLocalWorkspace();
  const raids = await listRaids(workspace.partyId);
  return <div>
    <header className="page-header flex flex-wrap items-end justify-between gap-4"><div><h1>Рейды</h1><p className="mt-2">Состав, добыча и продажи каждого выхода группы.</p></div><Link href="/raids/new" className="inline-flex min-h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">Новый рейд</Link></header>
    <RaidList raids={raids.map(raid => ({ id: raid.id, name: raid.name, instanceName: raid.instanceName, occurredAt: raid.occurredAt.toISOString(), present: raid.participants.filter(p => p.status === "PRESENT").length, drops: raid.lootDrops.length }))} />
  </div>;
}
