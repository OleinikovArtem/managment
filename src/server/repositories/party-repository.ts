import "server-only";

import { prisma } from "@/lib/db/prisma";

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

export async function resetPartyData(partyId: string) {
  await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT set_config('app.party_reset', 'on', true)`;
    await transaction.paymentAllocation.deleteMany({ where: { partyId } });
    await transaction.ledgerEntry.deleteMany({ where: { partyId } });
    await transaction.ledgerTransaction.deleteMany({ where: { partyId } });
    await transaction.memberPayment.deleteMany({ where: { partyId } });
    await transaction.saleShare.deleteMany({ where: { partyId } });
    await transaction.saleTransaction.deleteMany({ where: { partyId } });
    await transaction.lootDrop.deleteMany({ where: { partyId } });
    await transaction.raidParticipant.deleteMany({ where: { partyId } });
    await transaction.raid.deleteMany({ where: { partyId } });
    await transaction.partyCompositionMember.deleteMany({ where: { partyId } });
    await transaction.partyComposition.deleteMany({ where: { partyId } });
    await transaction.partyMemberProfile.deleteMany({ where: { partyId } });
    await transaction.partyMember.deleteMany({ where: { partyId } });
  });
}
