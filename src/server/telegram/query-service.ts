import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { DiscoveredSource } from "./connection-service";
import type { TelegramAllocation } from "./sale-parser";

export async function getTelegramSettings(partyId: string) {
  const config = await prisma.partyTelegramBotConfig.findUnique({ where: { partyId }, select: {
    botUsername: true, webhookEnabled: true, chatId: true, chatTitle: true, senderId: true, senderUsername: true, discoveries: true, lastReceivedAt: true,
  } });
  return config ? { ...config, discoveries: config.discoveries as DiscoveredSource[], lastReceivedAt: config.lastReceivedAt?.toISOString() ?? null } : null;
}

export async function listTelegramImports(partyId: string) {
  const records = await prisma.telegramSaleImport.findMany({ where: { partyId }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 100,
    select: { id: true, messageId: true, rawText: true, correctedText: true, status: true, reason: true, allocations: true, createdAt: true, receivedAt: true, updatedAt: true },
  });
  return records.map(record => ({ ...record, allocations: record.allocations as TelegramAllocation[], createdAt: record.createdAt.toISOString(), receivedAt: record.receivedAt.toISOString(), updatedAt: record.updatedAt.toISOString() }));
}

export async function unreadTelegramImports(partyId: string, userId: string) {
  const records = await prisma.telegramSaleImport.findMany({
    where: { partyId, status: { in: ["PROCESSED", "NEEDS_REVIEW", "PENDING"] }, reads: { none: { userId } } },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 20,
    select: { id: true, status: true, reason: true, allocations: true, updatedAt: true },
  });
  return records.map(record => ({ ...record, allocations: record.allocations as TelegramAllocation[], updatedAt: record.updatedAt.toISOString() }));
}
