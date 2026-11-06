import { Suspense } from "react";
import { io } from "next/cache";
import { redirect } from "next/navigation";
import { TelegramBotSettings } from "@/features/auth/telegram-bot-settings";
import { requirePartyPageAccess } from "@/server/auth/party-access";
import { hasPartyTelegramBot } from "@/server/services/account-party-service";

export default function TelegramSettingsPage() {
  return <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">Загружаем настройки…</p>}><TelegramSettingsContent /></Suspense>;
}

async function TelegramSettingsContent() {
  await io();
  const access = await requirePartyPageAccess();
  if (!access.isOwner) redirect("/settings");
  const configured = await hasPartyTelegramBot(access.partyId);
  return <div className="space-y-6"><header className="page-header"><h1>Telegram</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Подключите receiving bot для будущего импорта уведомлений о продажах. Токен виден только владельцу и хранится в зашифрованном виде.</p></header><TelegramBotSettings configured={configured} /></div>;
}
