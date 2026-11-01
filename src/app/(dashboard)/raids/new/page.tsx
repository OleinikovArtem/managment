import Link from "next/link";
import { Suspense } from "react";
import { io } from "next/cache";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RaidForm } from "@/features/raids/raid-form";
import { ensureLocalWorkspace } from "@/server/bootstrap/local-workspace";
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
  const workspace = await ensureLocalWorkspace();
  const setup = await getRaidSetup(workspace.partyId);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/raids" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft aria-hidden="true" size={16} />
        К рейдам
      </Link>
      <header>
        <p className="text-sm font-medium text-primary">{workspace.partyName}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Новый рейд</h1>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Данные рейда</CardTitle>
          <CardDescription>
            Рейд, attendance snapshot и указанные выпадения сохраняются одной транзакцией.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RaidForm
            members={setup.members.map((member) => ({
              ...member,
              status: "PRESENT" as const,
            }))}
            items={setup.items}
            submitLabel="Создать рейд"
          />
        </CardContent>
      </Card>
    </div>
  );
}
