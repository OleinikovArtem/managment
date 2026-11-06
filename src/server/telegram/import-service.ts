import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createPartySaleRecord, isRetryableDatabaseError } from "@/server/repositories/sale-repository";
import { SaleOperationError } from "@/features/sales/sale-errors";
import { allocateTelegramRow, normalizeTelegramName, parseTelegramSale, TelegramReviewError, type TelegramAllocation, type LootCandidate } from "./sale-parser";
import type { DiscoveredSource } from "./connection-service";

const id = z.number().int().safe();
export const telegramUpdateSchema = z.object({
  update_id: id.nonnegative(),
  message: z.unknown().optional(), edited_message: z.unknown().optional(),
});
const messageSchema = z.object({
  message_id: id.positive(), date: id.nonnegative().max(253_402_300_799),
  chat: z.object({ id, type: z.enum(["group", "supergroup"]), title: z.string().max(240).optional() }),
  from: z.object({ id: id.positive(), is_bot: z.literal(true), username: z.string().max(64).optional() }),
  text: z.string().max(16_000).optional(), caption: z.string().max(16_000).optional(),
  forward_origin: z.unknown().optional(), sender_chat: z.unknown().optional(),
});
type SourceMessage = { partyId: string; chatId: string; senderId: string; messageId: string; updateId: string; rawText: string; sourceHash: string; receivedAt: Date };

async function transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 25_000, maxWait: 10_000 }); }
    catch (error) {
      if (attempt < 2 && (isRetryableDatabaseError(error) || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"))) {
        await new Promise(resolve => setTimeout(resolve, 40 * (attempt + 1))); continue;
      }
      throw error;
    }
  }
}

async function lock(tx: Prisma.TransactionClient, partyId: string) {
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${partyId}, 0))`;
}

async function importSale(source: SourceMessage, webhookId?: string, retryId?: string, correctedText?: string) {
  const identity = { partyId: source.partyId, chatId: source.chatId, messageId: source.messageId };
  try {
    return await transaction(async tx => {
      await lock(tx, source.partyId);
      if (webhookId && !await tx.partyTelegramBotConfig.findFirst({ where: { partyId: source.partyId, webhookId, webhookEnabled: true, chatId: source.chatId, senderId: source.senderId } })) return;
      const existing = await tx.telegramSaleImport.findUnique({ where: { partyId_chatId_messageId: identity } });
      if (existing && existing.status !== "PENDING" && (!retryId || existing.id !== retryId || existing.status !== "NEEDS_REVIEW")) return;
      const rows = parseTelegramSale(correctedText ?? source.rawText);
      if (!rows) throw new TelegramReviewError("Это не распознаваемое уведомление об успешной продаже.");
      const candidates = new Map<string, LootCandidate[]>();
      const plan: TelegramAllocation[] = [];
      for (const row of rows) {
        const normalizedName = normalizeTelegramName(row.name);
        const [items, alias] = await Promise.all([
          tx.item.findMany({ where: { OR: [{ normalizedName }, { displayName: { equals: row.name.trim(), mode: "insensitive" } }] }, select: { id: true } }),
          tx.telegramItemAlias.findUnique({ where: { partyId_normalizedName: { partyId: source.partyId, normalizedName } }, select: { itemId: true } }),
        ]);
        const ids = new Set(items.map(item => item.id));
        if (alias) ids.add(alias.itemId);
        if (ids.size !== 1) throw new TelegramReviewError(`${ids.size ? "Неоднозначное название" : "Предмет не найден"}: ${row.name}. Добавьте соответствие названия.`);
        const itemId = [...ids][0];
        if (!candidates.has(itemId)) {
          const loot = await tx.lootDrop.findMany({
            where: { partyId: source.partyId, itemId }, take: 2001,
            include: { raid: { select: { id: true, name: true, occurredAt: true, participants: { where: { status: "PRESENT" }, select: { id: true } } } }, saleTransactions: { select: { quantitySold: true } } },
          });
          if (loot.length > 2000) throw new TelegramReviewError("Слишком много поступлений одного предмета для автоматического разбора.");
          candidates.set(itemId, loot.map(drop => ({ id: drop.id, itemId, raidId: drop.raid.id, raidName: drop.raid.name, quantity: drop.quantity, createdAt: drop.createdAt, occurredAt: drop.raid.occurredAt, sold: drop.saleTransactions.reduce((sum, sale) => sum + sale.quantitySold, 0) })));
        }
        const available = candidates.get(itemId)!;
        const allocations = allocateTelegramRow(row, available);
        for (const allocation of allocations) available.find(drop => drop.id === allocation.lootDropId)!.sold += allocation.quantity;
        plan.push(...allocations);
      }
      if (plan.length > 100) throw new TelegramReviewError("Продажа затрагивает больше 100 поступлений. Нужен ручной разбор.");
      const record = existing ?? await tx.telegramSaleImport.create({ data: { ...source, status: "NEEDS_REVIEW" } });
      for (let index = 0; index < plan.length; index++) {
        const allocation = plan[index];
        const sale = await createPartySaleRecord(tx, source.partyId, {
          lootDropId: allocation.lootDropId, quantitySold: allocation.quantity, totalPrice: BigInt(allocation.amount), receivedAt: source.receivedAt,
          idempotencyKey: `telegram:${record.id}:${index}`, comment: `Telegram · ${source.chatId}/${source.messageId}`,
        });
        allocation.saleId = sale.id;
      }
      await tx.telegramSaleImport.update({ where: { id: record.id }, data: { status: "PROCESSED", reason: null, allocations: plan, correctedText: correctedText ?? null } });
      await tx.telegramImportRead.deleteMany({ where: { importId: record.id } });
      await tx.partyAuditEvent.create({ data: { partyId: source.partyId, actorNameSnapshot: "Telegram · Igri", action: "IMPORT", entityType: "telegram", entityId: record.id, summary: `Автоматически учтено ${rows.length} строк продажи (${source.chatId}/${source.messageId}).` } });
    });
  } catch (error) {
    if (!(error instanceof TelegramReviewError) && !(error instanceof SaleOperationError)) throw error;
    // A separate transaction runs only after the complete financial transaction rolled back.
    await transaction(async tx => {
      await lock(tx, source.partyId);
      const existing = await tx.telegramSaleImport.findUnique({ where: { partyId_chatId_messageId: identity } });
      if (existing && !["NEEDS_REVIEW", "PENDING"].includes(existing.status)) return;
      if (existing) await tx.telegramSaleImport.update({ where: { id: existing.id }, data: { status: "NEEDS_REVIEW", reason: error.message.slice(0, 500), correctedText: correctedText ?? existing.correctedText } });
      else await tx.telegramSaleImport.create({ data: { ...source, status: "NEEDS_REVIEW", reason: error.message.slice(0, 500) } });
    });
  }
}

export async function receiveTelegramUpdate(webhookId: string, payload: unknown) {
  const update = telegramUpdateSchema.parse(payload);
  const parsed = messageSchema.safeParse(update.message ?? update.edited_message);
  if (!parsed.success) return;
  const message = parsed.data;
  if (message.forward_origin || message.sender_chat) return;
  const config = await prisma.partyTelegramBotConfig.findUnique({ where: { webhookId } });
  if (!config?.webhookEnabled || String(message.from.id) === config.botId) return;
  const rawText = message.text ?? message.caption;
  if (!rawText) return;
  await transaction(async tx => {
    await lock(tx, config.partyId);
    const current = await tx.partyTelegramBotConfig.findFirst({ where: { partyId: config.partyId, webhookId, webhookEnabled: true } });
    if (!current) return;
    const sources = (Array.isArray(current.discoveries) ? current.discoveries : []) as DiscoveredSource[];
    const next = [{ chatId: String(message.chat.id), chatTitle: message.chat.title ?? String(message.chat.id), senderId: String(message.from.id), senderUsername: message.from.username ?? String(message.from.id) }, ...sources.filter(s => s.chatId !== String(message.chat.id) || s.senderId !== String(message.from.id))].slice(0, 20);
    await tx.partyTelegramBotConfig.update({ where: { partyId: config.partyId }, data: { discoveries: next, lastReceivedAt: new Date() } });
  });
  if (config.chatId !== String(message.chat.id) || config.senderId !== String(message.from.id)) return;
  const source: SourceMessage = { partyId: config.partyId, chatId: String(message.chat.id), senderId: String(message.from.id), messageId: String(message.message_id), updateId: String(update.update_id), rawText, sourceHash: createHash("sha256").update(rawText).digest("hex"), receivedAt: new Date(message.date * 1000) };
  const existing = await prisma.telegramSaleImport.findUnique({ where: { partyId_chatId_messageId: { partyId: source.partyId, chatId: source.chatId, messageId: source.messageId } } });
  if (update.edited_message) {
    await transaction(async tx => {
      await lock(tx, config.partyId);
      const record = await tx.telegramSaleImport.findUnique({ where: { partyId_chatId_messageId: { partyId: source.partyId, chatId: source.chatId, messageId: source.messageId } } });
      if (record) {
        if (record.sourceHash === source.sourceHash) return;
        await tx.telegramSaleImport.update({ where: { id: record.id }, data: { reason: "Сообщение Telegram изменено. Учтённые продажи не изменялись; проверьте исходное сообщение.", ...(["NEEDS_REVIEW", "PENDING"].includes(record.status) ? { status: "NEEDS_REVIEW", rawText, sourceHash: source.sourceHash, correctedText: null } : {}) } });
        await tx.telegramImportRead.deleteMany({ where: { importId: record.id } });
      } else if (/(sale|sold)/i.test(rawText)) await tx.telegramSaleImport.create({ data: { ...source, status: "NEEDS_REVIEW", reason: "Получено только редактирование сообщения. Проверьте и запустите повторный разбор." } });
    });
    return;
  }
  if (existing && existing.status !== "PENDING") return;
  let candidate = false;
  try { candidate = parseTelegramSale(rawText) !== null; } catch { candidate = true; }
  if (candidate) {
    // Durable inbox precedes processing. A timeout leaves a retryable receipt,
    // even if Telegram eventually stops redelivering during an extended outage.
    await prisma.telegramSaleImport.createMany({ data: [{ ...source, status: "PENDING" }], skipDuplicates: true });
    await importSale(source, webhookId);
  }
}

export async function retryTelegramImport(partyId: string, importId: string, correctedText?: string) {
  const record = await prisma.telegramSaleImport.findFirstOrThrow({ where: { id: importId, partyId, status: { in: ["NEEDS_REVIEW", "PENDING"] } } });
  const source: SourceMessage = { partyId, chatId: record.chatId, senderId: record.senderId, messageId: record.messageId, updateId: record.updateId, rawText: record.rawText, sourceHash: record.sourceHash, receivedAt: record.receivedAt };
  await importSale(source, undefined, record.id, correctedText ?? record.correctedText ?? undefined);
  return prisma.telegramSaleImport.findUniqueOrThrow({ where: { id: record.id }, select: { status: true, reason: true } });
}
