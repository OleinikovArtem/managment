import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import {
  encryptTelegramBotToken,
  readTelegramBotToken,
} from "@/server/services/telegram-credential-service";
import { telegramApi, TelegramConnectionError } from "./bot-api";

export type DiscoveredSource = {
  chatId: string;
  chatTitle: string;
  senderId: string;
  senderUsername: string;
};
export function secretHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function verifyWebhookSecret(expected: string | null, value: string | null) {
  if (!expected || !value || value.length > 256) return false;
  const actual = secretHash(value);
  return (
    expected.length === actual.length && timingSafeEqual(Buffer.from(expected), Buffer.from(actual))
  );
}

export async function connectTelegramBot(partyId: string, suppliedToken?: string) {
  const base = new URL(
    process.env.TELEGRAM_WEBHOOK_BASE_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  );
  if (base.protocol !== "https:" || base.username || base.password || base.pathname !== "/")
    throw new TelegramConnectionError(
      "Для webhook нужен публичный HTTPS-адрес. Локально задайте TELEGRAM_WEBHOOK_BASE_URL с адресом туннеля.",
    );
  const token = suppliedToken ?? (await readTelegramBotToken(partyId));
  const bot = await telegramApi<{ id: number; username?: string; is_bot: boolean }>(token, "getMe");
  if (!bot.is_bot || !Number.isSafeInteger(bot.id))
    throw new TelegramConnectionError("Telegram не подтвердил receiving bot.");
  const owned = await prisma.partyTelegramBotConfig.findFirst({
    where: { botId: String(bot.id), partyId: { not: partyId } },
    select: { partyId: true },
  });
  if (owned)
    throw new TelegramConnectionError(
      "Этот receiving bot уже подключён к другой группе. Создайте отдельного бота.",
    );
  const previous = await prisma.partyTelegramBotConfig.findUnique({ where: { partyId } });
  const oldToken =
    previous?.webhookEnabled && previous.botId !== String(bot.id)
      ? await readTelegramBotToken(partyId)
      : undefined;
  const webhookId = randomBytes(24).toString("hex");
  const secret = randomBytes(32).toString("hex");
  const credentials = encryptTelegramBotToken(token);
  await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`telegram-bot:${bot.id}`}, 0))`;
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${partyId}, 0))`;
      const current = await tx.partyTelegramBotConfig.findUnique({ where: { partyId } });
      if ((current?.webhookId ?? null) !== (previous?.webhookId ?? null))
        throw new TelegramConnectionError(
          "Настройки изменились параллельно. Обновите страницу и повторите подключение.",
        );
      const taken = await tx.partyTelegramBotConfig.findFirst({
        where: { botId: String(bot.id), partyId: { not: partyId } },
        select: { partyId: true },
      });
      if (taken)
        throw new TelegramConnectionError("Этот receiving bot уже подключён к другой группе.");
      if (oldToken) await telegramApi(oldToken, "deleteWebhook", { drop_pending_updates: false });
      const data = {
        ...credentials,
        botId: String(bot.id),
        botUsername: bot.username ?? null,
        webhookId,
        webhookSecretHash: secretHash(secret),
        webhookEnabled: false,
        ...(previous?.botId && previous.botId !== String(bot.id)
          ? { chatId: null, senderId: null, chatTitle: null, senderUsername: null, discoveries: [] }
          : {}),
      };
      await tx.partyTelegramBotConfig.upsert({
        where: { partyId },
        create: { partyId, ...data },
        update: data,
      });
      // Serialize lifecycle changes, including remote registration, with ingestion.
      await telegramApi(token, "setWebhook", {
        url: `${base.origin}/api/telegram/webhook/${webhookId}`,
        secret_token: secret,
        allowed_updates: ["message", "edited_message"],
        max_connections: 2,
        drop_pending_updates: false,
      });
      await tx.partyTelegramBotConfig.update({
        where: { partyId },
        data: { webhookEnabled: true },
      });
    },
    { timeout: 35_000, maxWait: 10_000 },
  );
}

export async function disconnectTelegramBot(partyId: string) {
  const config = await prisma.partyTelegramBotConfig.findUnique({ where: { partyId } });
  if (!config) return;
  const token = await readTelegramBotToken(partyId);
  // Serialize remote removal too, so a parallel reconnect cannot be deleted later.
  await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${partyId}, 0))`;
      const current = await tx.partyTelegramBotConfig.findUnique({ where: { partyId } });
      if (!current) return;
      if (current.webhookId !== config.webhookId)
        throw new TelegramConnectionError(
          "Бот изменился параллельно. Обновите страницу перед отключением.",
        );
      try {
        await telegramApi(token, "deleteWebhook", { drop_pending_updates: false });
      } catch {
        /* Revoke locally even if Telegram is unavailable. */
      }
      await tx.partyTelegramBotConfig.delete({ where: { partyId } });
    },
    { timeout: 20_000, maxWait: 10_000 },
  );
}

export async function testTelegramConnection(partyId: string) {
  const config = await prisma.partyTelegramBotConfig.findUniqueOrThrow({ where: { partyId } });
  const token = await readTelegramBotToken(partyId);
  await telegramApi(token, "getMe");
  const info = await telegramApi<{
    url: string;
    pending_update_count: number;
    last_error_date?: number;
  }>(token, "getWebhookInfo");
  if (
    !config.webhookEnabled ||
    !config.webhookId ||
    !info.url.endsWith(`/api/telegram/webhook/${config.webhookId}`)
  )
    throw new TelegramConnectionError(
      "Webhook не активен или заменён другим приложением. Нажмите «Подключить webhook».",
    );
  return `Telegram доступен. В очереди: ${info.pending_update_count}.${info.last_error_date ? " Telegram сообщал об ошибке доставки; проверьте получение нового сообщения." : ""}`;
}
