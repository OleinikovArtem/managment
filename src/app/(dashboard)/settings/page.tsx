import { Suspense } from "react";
import { io } from "next/cache";
import { SettingsForm } from "@/features/settings/settings-form";
import { BackupManager } from "@/features/settings/backup-manager";
import { ResetDataCard } from "@/features/settings/reset-data-card";
import { ensureLocalWorkspace } from "@/server/bootstrap/local-workspace";
import { getPartySettings } from "@/server/services/party-service";
import { listLocalBackups } from "@/server/services/backup-service";

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
  const [party, backups] = await Promise.all([
    getPartySettings(workspace.partyId),
    listLocalBackups(),
  ]);

  return (
    <div className="space-y-7">
      <header>
        <p className="text-sm font-medium text-primary">Рабочее пространство</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Настройки</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Основные параметры локальной группы.
        </p>
      </header>
      <SettingsForm partyName={party.name} />
      <BackupManager backups={backups} />
      <ResetDataCard />
    </div>
  );
}
