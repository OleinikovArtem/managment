import { Suspense } from "react";
import { io } from "next/cache";
import { SettingsForm } from "@/features/settings/settings-form";
import { ResetDataCard } from "@/features/settings/reset-data-card";
import { ensureLocalWorkspace } from "@/server/bootstrap/local-workspace";
import { getPartySettings } from "@/server/services/party-service";

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="h-72 animate-pulse rounded-2xl bg-muted/50" />}>
      <SettingsContent />
    </Suspense>
  );
}

async function SettingsContent() {
  await io();
  const workspace = await ensureLocalWorkspace();
  const party = await getPartySettings(workspace.partyId);

  return (
    <div className="settings-page max-w-5xl space-y-8">
      <header className="page-header ">

        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Настройки</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Основные параметры локальной группы.
        </p>
      </header>
      <SettingsForm partyName={party.name} />
      <section className="rounded-xl border border-border p-5">
        <h2 className="text-base font-semibold">Резервные копии базы</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          В Vercel резервирование и восстановление выполняются в панели Neon. Для локальной базы
          сохраните dump командой <code>docker compose exec -T postgres pg_dump -U party_bank party_bank</code>.
        </p>
      </section>
      <ResetDataCard />
    </div>
  );
}
