"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePartyActionAccess } from "@/server/auth/party-access";
import { connectTelegramBot, disconnectTelegramBot, testTelegramConnection } from "@/server/telegram/connection-service";
import { TelegramConnectionError } from "@/server/telegram/bot-api";
import { prisma } from "@/lib/db/prisma";
import { recordPartyAuditEvent } from "@/server/services/party-audit-service";

const tokenSchema = z.string().trim().min(20, "Введите токен BotFather.").max(256, "Токен слишком длинный.").regex(/^\d{6,12}:[A-Za-z0-9_-]{20,}$/, "Проверьте формат токена BotFather.");
export type TelegramActionResult = { ok: true; message: string } | { ok: false; message: string };

export async function saveTelegramTokenAction(value: unknown): Promise<TelegramActionResult> {
  const access = await requirePartyActionAccess("OWNER");
  const parsed = tokenSchema.safeParse(value);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Проверьте токен." };
  try {
    await connectTelegramBot(access.partyId, parsed.data);
  } catch (error) {
    return { ok: false, message: error instanceof TelegramConnectionError ? error.message : "Не удалось подключить бота. Проверьте серверный ключ шифрования и попробуйте ещё раз." };
  }
  await recordPartyAuditEvent(access, { action: "UPDATE", entityType: "telegram", summary: "Сохранил или заменил токен Telegram-бота." });
  revalidatePath("/settings/telegram");
  return { ok: true, message: "Бот проверен, токен зашифрован, webhook подключён. Выберите чат и источник продаж." };
}

export async function removeTelegramTokenAction(): Promise<TelegramActionResult> {
  const access = await requirePartyActionAccess("OWNER");
  try {
    await disconnectTelegramBot(access.partyId);
  } catch {
    return { ok: false, message: "Не удалось отключить Telegram-бота." };
  }
  await recordPartyAuditEvent(access, { action: "DELETE", entityType: "telegram", summary: "Отключил Telegram-бота." });
  revalidatePath("/settings/telegram");
  return { ok: true, message: "Подключение удалено." };
}

export async function reconnectTelegramAction(): Promise<TelegramActionResult> {
  const access = await requirePartyActionAccess("OWNER");
  try {
    await connectTelegramBot(access.partyId);
    revalidatePath("/settings/telegram");
    return { ok: true, message: "Webhook подключён." };
  } catch (error) { return { ok: false, message: error instanceof TelegramConnectionError ? error.message : "Не удалось восстановить webhook. Попробуйте заново ввести токен." }; }
}

export async function testTelegramAction(): Promise<TelegramActionResult> {
  const access = await requirePartyActionAccess("OWNER");
  try { return { ok: true, message: await testTelegramConnection(access.partyId) }; }
  catch (error) { return { ok: false, message: error instanceof TelegramConnectionError ? error.message : "Не удалось проверить подключение." }; }
}

export async function saveTelegramSourceAction(chatId: string, senderId: string): Promise<TelegramActionResult> {
  const access = await requirePartyActionAccess("OWNER");
  if (!/^-?[1-9]\d{0,15}$/.test(chatId) || !/^[1-9]\d{0,15}$/.test(senderId) || !Number.isSafeInteger(Number(chatId)) || !Number.isSafeInteger(Number(senderId))) return { ok: false, message: "Выберите групповой или личный чат и исходного бота либо проверьте их числовые ID." };
  const config = await prisma.partyTelegramBotConfig.findUnique({ where: { partyId: access.partyId } });
  if (!config?.webhookEnabled) return { ok: false, message: "Сначала подключите webhook receiving bot." };
  const sources = Array.isArray(config.discoveries) ? config.discoveries : [];
  const source = sources.find(value => value && typeof value === "object" && !Array.isArray(value) && value.chatId === chatId && value.senderId === senderId) as { chatTitle?: string; senderUsername?: string } | undefined;
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${access.partyId}, 0))`;
    await tx.partyTelegramBotConfig.update({ where: { partyId: access.partyId }, data: { chatId, senderId, chatTitle: source?.chatTitle ?? chatId, senderUsername: source?.senderUsername ?? senderId } });
  });
  await recordPartyAuditEvent(access, { action: "UPDATE", entityType: "telegram", summary: `Выбрал источник продаж Telegram: чат ${chatId}, бот ${senderId}.` });
  revalidatePath("/settings/telegram");
  return { ok: true, message: "Источник выбран. Новые сообщения из этого чата и от этого бота будут обрабатываться автоматически." };
}
