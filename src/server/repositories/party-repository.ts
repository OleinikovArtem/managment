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
