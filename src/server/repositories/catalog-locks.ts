import type { Prisma } from "@/generated/prisma/client";

export async function lockStages(tx: Prisma.TransactionClient, exclusive = false) {
  if (exclusive) await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(715064, 1)`;
  else await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock_shared(715064, 1)`;
}
export async function lockParty(tx: Prisma.TransactionClient, partyId: string) {
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${partyId}, 0))`;
}
