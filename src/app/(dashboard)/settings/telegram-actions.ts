"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePartyActionAccess } from "@/server/auth/party-access";
import { removeTelegramBotToken, saveTelegramBotToken } from "@/server/services/telegram-credential-service";
import { recordPartyAuditEvent } from "@/server/services/party-audit-service";

const tokenSchema = z.string().trim().min(20, "Введите токен BotFather.").max(256, "Токен слишком длинный.").regex(/^\d{6,12}:[A-Za-z0-9_-]{20,}$/, "Проверьте формат токена BotFather.");
export type TelegramActionResult = { ok: true; message: string } | { ok: false; message: string };

export async function saveTelegramTokenAction(value: unknown): Promise<TelegramActionResult> {
  const access = await requirePartyActionAccess("OWNER");
  const parsed = tokenSchema.safeParse(value);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Проверьте токен." };
  try {
    await saveTelegramBotToken(access.partyId, parsed.data);
  } catch {
    return { ok: false, message: "Не удалось сохранить токен. Проверьте настройку ключа шифрования на сервере." };
  }
  await recordPartyAuditEvent(access, { action: "UPDATE", entityType: "telegram", summary: "Сохранил или заменил токен Telegram-бота." });
  revalidatePath("/settings/telegram");
  return { ok: true, message: "Токен зашифрован и сохранён на сервере." };
}

export async function removeTelegramTokenAction(): Promise<TelegramActionResult> {
  const access = await requirePartyActionAccess("OWNER");
  try {
    await removeTelegramBotToken(access.partyId);
  } catch {
    return { ok: false, message: "Не удалось отключить Telegram-бота." };
  }
  await recordPartyAuditEvent(access, { action: "DELETE", entityType: "telegram", summary: "Отключил Telegram-бота." });
  revalidatePath("/settings/telegram");
  return { ok: true, message: "Подключение удалено." };
}
