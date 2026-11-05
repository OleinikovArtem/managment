"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, Download, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ActionMenu } from "@/components/ui/action-menu";
import { Badge } from "@/components/ui/badge";
import { LocalDateTimeDisplay } from "@/features/raids/local-date-time-display";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { BackupSummary } from "@/server/services/backup-service";
import {
  createBackupAction,
  prepareRestoreAction,
  validateBackupAction,
} from "@/app/(dashboard)/settings/backup-actions";

type BackupManagerProps = { backups: BackupSummary[] };

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function BackupManager({ backups }: BackupManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [restoreInstructions, setRestoreInstructions] = useState<string | null>(null);
  const [validatingName, setValidatingName] = useState<string | null>(null);

  function createBackup() {
    setMessage(null);
    startTransition(async () => {
      const result = await createBackupAction();
      setMessage(result.message);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  }

  function validateBackup(name: string) {
    setValidatingName(name);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await validateBackupAction(name);
        setMessage(result.message);
        if (result.ok) toast.success(result.message);
        else toast.error(result.message);
      } finally {
        setValidatingName(null);
      }
    });
  }

  function prepareRestore(name: string) {
    if (
      !window.confirm(
        "Подготовить и проверить отдельный экземпляр этой копии? Текущая база не будет перезаписана.",
      )
    ) {
      return;
    }

    setRestoreInstructions(null);
    setMessage(null);
    startTransition(async () => {
      const result = await prepareRestoreAction(name);
      setMessage(result.message);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setRestoreInstructions(
        `Копия подготовлена в ${result.candidate.relativePath}. Автоматического переключения нет. Перед ручным восстановлением остановите приложение и сохраните текущие БД и data/uploads отдельно. Затем задайте DATABASE_URL="file:./${result.candidate.relativePath}/database.sqlite" и при необходимости перенесите файлы из подпапки uploads кандидата в data/uploads.`,
      );
      toast.success(result.message);
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <span className="text-muted-foreground">
            <Archive aria-hidden="true" size={18} />
          </span>
          <div className="space-y-1">
            <CardTitle>Резервные копии</CardTitle>
            <CardDescription>
              История группы и локальные файлы в одном архиве.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Создание копии не изменяет базу. Подготовка восстановления распаковывает
          проверенную копию в отдельный каталог и не перезаписывает текущие данные.
          Переключение БД и восстановление uploads выполняются вручную после остановки приложения.
        </p>
        <Button type="button" onClick={createBackup} disabled={isPending}>
          <Archive aria-hidden="true" />
          Создать резервную копию
        </Button>

        {message && (
          <p role="status" className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
            {message}
          </p>
        )}

        {restoreInstructions && (
          <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck aria-hidden="true" size={16} />
              Проверенная копия готова
            </p>
            <p className="break-all text-xs leading-5 text-muted-foreground">
              {restoreInstructions}
            </p>
          </div>
        )}

        {backups.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            Резервных копий пока нет.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {backups.map((backup) => (
              <li
                key={backup.name}
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <p className="break-all text-sm font-medium">{backup.name}</p>
                  <p className="text-xs text-muted-foreground">
                    <LocalDateTimeDisplay value={backup.createdAt} /> ·{" "}
                    {formatBytes(backup.size)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {validatingName === backup.name && <span className="text-xs text-muted-foreground" role="status">Проверка…</span>}
                  <a className="inline-flex min-h-10 items-center gap-2 px-2 text-sm hover:underline" href={`/api/backups/${encodeURIComponent(backup.name)}`}><Download size={14} aria-hidden="true" />Скачать</a>
                  <ActionMenu label={`Действия копии ${backup.name}`} disabled={isPending} items={[
                    { label: "Проверить копию", onClick: () => validateBackup(backup.name) },
                    { label: "Подготовить восстановление", onClick: () => prepareRestore(backup.name) },
                  ]} />
                </div>
              </li>
            ))}
          </ul>
        )}
        {backups.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Архивы хранятся локально в <Badge variant="outline">data/backups</Badge>.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
