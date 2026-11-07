import "server-only";

import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@/generated/prisma/client";
import { resolveResetCategories, type ResetCategory } from "@/features/settings/reset-plan";
import { isRetryableDatabaseError } from "./sale-repository";

export async function getPartyById(partyId: string) {
  return prisma.party.findUnique({
    where: { id: partyId },
  });
}

export async function renameParty(partyId: string, name: string) {
  return prisma.party.updateMany({
    where: { id: partyId },
    data: { name },
  });
}

export async function getPartyMemberCounts(partyId: string) {
  const [activeMembers, totalMembers] = await Promise.all([
    prisma.partyMember.count({ where: { partyId, isActive: true } }),
    prisma.partyMember.count({ where: { partyId } }),
  ]);

  return { activeMembers, totalMembers };
}

export async function resetPartyData(partyId: string, selection: readonly ResetCategory[]) {
  const categories = resolveResetCategories(selection);
  const selected = new Set(categories);
  for (let attempt = 0; ; attempt++) {
    try {
      await prisma.$transaction(
        async (transaction) => {
          await transaction.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${partyId}, 0))`;
          await transaction.$queryRaw`SELECT id FROM "Party" WHERE id = ${partyId} FOR UPDATE`;
          await transaction.$queryRaw`SELECT set_config('app.party_reset', 'on', true)`;
          if (selected.has("payments")) {
            await transaction.paymentAllocation.deleteMany({ where: { partyId } });
            const ledgerWhere = {
              partyId,
              ...(selected.has("sales") ? {} : { memberPaymentId: { not: null } }),
            };
            await transaction.ledgerEntry.deleteMany({
              where: { partyId, ledgerTransaction: ledgerWhere },
            });
            await transaction.ledgerTransaction.deleteMany({ where: ledgerWhere });
            await transaction.memberPayment.deleteMany({ where: { partyId } });
          }
          if (selected.has("sales")) {
            await transaction.saleShare.deleteMany({ where: { partyId } });
            await transaction.saleTransaction.deleteMany({ where: { partyId } });
            await transaction.raid.updateMany({ where: { partyId }, data: { lockedAt: null } });
            await transaction.lootDrop.updateMany({
              where: { partyId },
              data: { status: "RECEIVED" },
            });
            // Keep processed fingerprints: forwarding an old notice must not
            // recreate deleted sales. Stop unresolved imports from resuming.
            await transaction.telegramSaleImport.updateMany({
              where: { partyId, status: "PROCESSED" },
              data: {
                allocations: [],
                reason: "Связанные продажи удалены при сбросе данных группы.",
              },
            });
            await transaction.telegramSaleImport.updateMany({
              where: { partyId, status: { in: ["PENDING", "NEEDS_REVIEW"] } },
              data: {
                status: "IGNORED",
                reason: "Обработка остановлена при сбросе продаж группы.",
              },
            });
          }
          if (selected.has("loot")) await transaction.lootDrop.deleteMany({ where: { partyId } });
          if (selected.has("raids")) {
            await transaction.raidParticipant.deleteMany({ where: { partyId } });
            await transaction.raid.deleteMany({ where: { partyId } });
          }
          if (selected.has("compositions")) {
            await transaction.raid.updateMany({
              where: { partyId },
              data: { compositionId: null },
            });
            await transaction.partyCompositionMember.deleteMany({ where: { partyId } });
            await transaction.partyComposition.deleteMany({ where: { partyId } });
          }
          if (selected.has("members")) {
            await transaction.partyMemberProfile.deleteMany({ where: { partyId } });
            await transaction.partyMember.deleteMany({ where: { partyId } });
          }
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 30_000,
          maxWait: 10_000,
        },
      );
      return categories;
    } catch (error) {
      if (attempt >= 2 || !isRetryableDatabaseError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 40 * (attempt + 1)));
    }
  }
}
