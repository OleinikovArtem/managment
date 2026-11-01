import Link from "next/link";
import { Suspense } from "react";
import { io } from "next/cache";
import { CalendarDays, Plus, ScrollText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LocalDateTimeDisplay } from "@/features/raids/local-date-time-display";
import { ensureLocalWorkspace } from "@/server/bootstrap/local-workspace";
import { listRaids } from "@/server/services/raid-service";

export default function RaidsPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted/50" />}>
      <RaidsContent />
    </Suspense>
  );
}

async function RaidsContent() {
  await io();
  const workspace = await ensureLocalWorkspace();
  const raids = await listRaids(workspace.partyId);

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">{workspace.partyName}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Рейды</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            История проведённых рейдов, состав участников и отдельные записи о выпадениях.
          </p>
        </div>
        <Link
          href="/raids/new"
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
        >
          <Plus aria-hidden="true" />
          Новый рейд
        </Link>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>История рейдов</CardTitle>
          <CardDescription>Найдено: {raids.length}</CardDescription>
        </CardHeader>
        <CardContent>
          {raids.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center">
              <CalendarDays aria-hidden="true" className="mx-auto text-primary" />
              <h2 className="mt-4 font-medium">Рейдов пока нет</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Создайте рейд, чтобы сохранить исторический состав и выпадения.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {raids.map((raid) => {
                const presentCount = raid.participants.filter(
                  ({ status }) => status === "PRESENT",
                ).length;
                const lootCount = raid.lootDrops.length;
                return (
                  <li key={raid.id} className="py-4 first:pt-0 last:pb-0">
                    <Link href={`/raids/${raid.id}`} className="block rounded-lg hover:text-primary">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h2 className="font-medium">{raid.name}</h2>
                          {raid.instanceName && (
                            <p className="mt-1 text-sm text-muted-foreground">{raid.instanceName}</p>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          <LocalDateTimeDisplay value={raid.occurredAt.toISOString()} />
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {presentCount} участников · {lootCount}{" "}
                        {lootCount === 1 ? "выпадение" : "выпадений"}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ScrollText aria-hidden="true" size={15} />
        Выпадения являются отдельными историческими записями и ссылаются на каталог предметов.
      </div>
    </div>
  );
}
