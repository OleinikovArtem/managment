"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requirePartyActionAccess } from "@/server/auth/party-access";
import { retryTelegramImport } from "@/server/telegram/import-service";
import { normalizeTelegramName } from "@/server/telegram/sale-parser";
import { recordPartyAuditEvent } from "@/server/services/party-audit-service";

type Result = { ok: boolean; message: string };

export async function retryTelegramImportAction(id: string, text: string): Promise<Result> {
  const access = await requirePartyActionAccess("ADMIN");
  if (!id || !z.string().min(1).max(16_000).safeParse(text).success) return { ok: false, message: "Проверьте текст сообщения (до 16 000 символов)." };
  try {
    const result = await retryTelegramImport(access.partyId, id, text);
    await recordPartyAuditEvent(access, { action: "RETRY", entityType: "telegram", entityId: id, summary: "Повторил разбор уведомления Telegram." });
    revalidatePath("/telegram"); revalidatePath("/dashboard"); revalidatePath("/ledger"); revalidatePath("/sales"); revalidatePath("/raids", "layout");
    return { ok: result.status === "PROCESSED", message: result.status === "PROCESSED" ? "Продажа учтена, доли распределены." : result.reason ?? "Нужен разбор." };
  } catch { return { ok: false, message: "Не удалось повторить обработку. Обновите страницу и проверьте состояние сообщения." }; }
}

export async function dismissTelegramImportAction(id: string): Promise<Result> {
  const access = await requirePartyActionAccess("ADMIN");
  const dismissed = await prisma.telegramSaleImport.updateMany({ where: { id, partyId: access.partyId, status: { in: ["NEEDS_REVIEW", "PENDING"] } }, data: { status: "IGNORED", reason: "Исключено администратором из импорта." } });
  if (!dismissed.count) return { ok: false, message: "Статус сообщения уже изменился. Обновите страницу перед следующим действием." };
  await recordPartyAuditEvent(access, { action: "DISMISS", entityType: "telegram", entityId: id, summary: "Исключил уведомление Telegram из импорта." });
  revalidatePath("/telegram");
  return { ok: true, message: "Сообщение исключено; финансовые записи не создавались." };
}

export async function saveTelegramAliasAction(name: string, itemId: string): Promise<Result> {
  const access = await requirePartyActionAccess("ADMIN");
  if (!z.string().trim().min(1).max(240).safeParse(name).success) return { ok: false, message: "Введите название из Telegram (до 240 символов)." };
  const normalizedName = normalizeTelegramName(name);
  const item = await prisma.item.findUnique({ where: { id: itemId }, select: { id: true } });
  const collision = await prisma.item.findFirst({ where: { normalizedName, id: { not: itemId } }, select: { id: true } });
  if (!item || collision) return { ok: false, message: "Предмет не найден или название совпадает с другим предметом каталога." };
  await prisma.telegramItemAlias.upsert({ where: { partyId_normalizedName: { partyId: access.partyId, normalizedName } }, create: { partyId: access.partyId, itemId, name: name.trim(), normalizedName }, update: { itemId, name: name.trim() } });
  await recordPartyAuditEvent(access, { action: "UPDATE", entityType: "telegram-alias", summary: `Сопоставил название Telegram: ${name.trim().slice(0, 240)}.` });
  revalidatePath("/telegram");
  return { ok: true, message: "Соответствие сохранено. Повторите обработку нужного сообщения." };
}

export async function removeTelegramAliasAction(id: string): Promise<Result> {
  const access = await requirePartyActionAccess("ADMIN");
  await prisma.telegramItemAlias.deleteMany({ where: { id, partyId: access.partyId } });
  await recordPartyAuditEvent(access, { action: "DELETE", entityType: "telegram-alias", entityId: id, summary: "Удалил соответствие названия Telegram." });
  revalidatePath("/telegram");
  return { ok: true, message: "Соответствие удалено." };
}

export async function readTelegramImportsAction(): Promise<void> {
  const access = await requirePartyActionAccess("MEMBER");
  const records = await prisma.telegramSaleImport.findMany({ where: { partyId: access.partyId }, select: { id: true }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 100 });
  if (records.length) await prisma.telegramImportRead.createMany({ data: records.map(record => ({ importId: record.id, userId: access.userId })), skipDuplicates: true });
}
