import { Suspense } from "react";
import { io } from "next/cache";
import { requirePartyPageAccess } from "@/server/auth/party-access";
import { prisma } from "@/lib/db/prisma";
import { listTelegramImports } from "@/server/telegram/query-service";
import { TelegramImportHistory } from "@/features/telegram/import-history";

export default function TelegramPage() {
  return <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">Загружаем сообщения Telegram…</p>}><TelegramContent /></Suspense>;
}

async function TelegramContent() {
  await io();
  const access = await requirePartyPageAccess();
  const [records, items, aliases] = await Promise.all([
    listTelegramImports(access.partyId),
    access.canManage ? prisma.item.findMany({ select: { id: true, canonicalName: true }, orderBy: { normalizedName: "asc" }, take: 2000 }) : [],
    access.canManage ? prisma.telegramItemAlias.findMany({ where: { partyId: access.partyId }, select: { id: true, name: true, item: { select: { canonicalName: true } } }, orderBy: { normalizedName: "asc" }, take: 2000 }) : [],
  ]);
  return <div className="space-y-6"><header className="page-header"><h1>Продажи из Telegram</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">История автоматического учёта, распределение по рейдам и сообщения, требующие разбора.</p></header><TelegramImportHistory records={records} items={items} aliases={aliases} canManage={access.canManage} /></div>;
}
