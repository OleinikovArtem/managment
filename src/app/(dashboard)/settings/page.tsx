import Link from "next/link";
import { Suspense } from "react";
import { io } from "next/cache";
import { ResetDataCard } from "@/features/settings/reset-data-card";
import { SettingsForm } from "@/features/settings/settings-form";
import { SettingsTabs } from "@/features/settings/settings-tabs";
import { StageDefaultForm } from "@/features/settings/stage-default-form";
import { TelegramBotSettings } from "@/features/auth/telegram-bot-settings";
import { UserDisplayNameForm } from "@/features/auth/user-display-name-form";
import { SettingsSkeleton } from "@/components/ui/page-skeleton";
import { requirePartyPageAccess, requireSignedInPageUser } from "@/server/auth/party-access";
import { getPartySettings } from "@/server/services/party-service";
import { getInstanceSetup } from "@/server/repositories/instance-repository";
import { getTelegramSettings } from "@/server/telegram/query-service";

export default function SettingsPage() {
  return (
    <div className="settings-page max-w-5xl space-y-6">
      <header className="page-header">
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Настройки</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Параметры группы, подключение Telegram и выборочный сброс данных.
        </p>
      </header>
      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsContent />
      </Suspense>
    </div>
  );
}

async function SettingsContent() {
  await io();
  const access = await requirePartyPageAccess();
  const [party, catalog, user, telegramSettings] = await Promise.all([
    getPartySettings(access.partyId),
    getInstanceSetup(access.partyId),
    requireSignedInPageUser(),
    access.isOwner ? getTelegramSettings(access.partyId) : Promise.resolve(null),
  ]);
  const effectiveStage =
    catalog.stages.available.find((stage) => stage.id === catalog.stages.globalStageId)?.name ??
    "нет доступной стадии";

  return (
    <SettingsTabs
      group={
        <section className="space-y-8" aria-labelledby="settings-group-heading">
          <h2 id="settings-group-heading" className="sr-only">
            Настройки группы
          </h2>
          <SettingsForm partyName={party.name} canManage={access.canManage} />
          <StageDefaultForm
            stages={catalog.stages.available}
            selected={catalog.stages.selection}
            revision={catalog.stages.selectionRevision}
            canManage={access.canManage}
            effectiveName={effectiveStage}
          />
          <section>
            <h2 className="mb-3 text-base font-semibold">Ваш аккаунт</h2>
            <UserDisplayNameForm displayName={user.name} />
          </section>
          <nav
            className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-5"
            aria-label="Управление группой"
          >
            {access.canManage && (
              <Link className="text-sm underline underline-offset-4" href="/settings/access">
                Доступ к группе
              </Link>
            )}
            <Link className="text-sm underline underline-offset-4" href="/settings/activity">
              История действий
            </Link>
          </nav>
        </section>
      }
      telegram={
        <section className="space-y-5" aria-labelledby="settings-telegram-heading">
          <header>
            <h2 id="settings-telegram-heading" className="text-xl font-semibold">
              Telegram
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Автоматически учитывайте распознанные продажи и проверяйте их исходные сообщения.
            </p>
          </header>
          {access.isOwner && telegramSettings ? (
            <TelegramBotSettings settings={telegramSettings} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Настраивать receiving bot может только владелец группы.
            </p>
          )}
        </section>
      }
      reset={
        <section className="space-y-5" aria-labelledby="settings-reset-heading">
          <header>
            <h2 id="settings-reset-heading" className="text-xl font-semibold text-destructive">
              Reset
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Выберите категории данных группы. Зависимые записи будут учтены вместе.
            </p>
          </header>
          {access.isOwner ? (
            <ResetDataCard />
          ) : (
            <p className="text-sm text-muted-foreground">
              Сбрасывать данные группы может только владелец.
            </p>
          )}
        </section>
      }
    />
  );
}
