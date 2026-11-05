import "server-only";

import { prisma } from "@/lib/db/prisma";
import type { CompositionInput } from "@/features/compositions/composition-schema";

export function listPartyCompositions(partyId: string) {
  return prisma.partyComposition.findMany({
    where: { partyId },
    include: { members: { include: { member: true, profile: true }, orderBy: { slotOrder: "asc" } } },
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
  });
}

export function getPartyComposition(partyId: string, id: string) {
  return prisma.partyComposition.findFirst({ where: { partyId, id }, include: { members: { include: { member: true, profile: true }, orderBy: { slotOrder: "asc" } } } });
}

export async function createPartyComposition(partyId: string, input: CompositionInput) {
  return prisma.$transaction(async (transaction) => {
    const memberIds = input.slots.map(({ memberId }) => memberId);
    const members = await transaction.partyMember.findMany({ where: { partyId, id: { in: memberIds }, isActive: true }, select: { id: true } });
    if (members.length !== new Set(memberIds).size) throw new Error("Выберите только активных участников этой группы.");
    const profileIds = input.slots.flatMap(({ profileId }) => profileId ? [profileId] : []);
    if (profileIds.length) {
      const profiles = await transaction.partyMemberProfile.findMany({ where: { partyId, id: { in: profileIds }, isActive: true }, select: { id: true, memberId: true } });
      if (profiles.length !== profileIds.length || input.slots.some(({ memberId, profileId }) => profileId && !profiles.some((profile) => profile.id === profileId && profile.memberId === memberId))) {
        throw new Error("Выберите профиль, принадлежащий выбранному участнику.");
      }
    }
    return transaction.partyComposition.create({
      data: {
        partyId,
        name: input.name,
        description: input.description || null,
        focus: input.focus || null,
        maxMembers: 36,
        members: { create: input.slots.map(({ memberId, profileId }, slotOrder) => ({
          member: { connect: { partyId_id: { partyId, id: memberId } } },
          ...(profileId ? { profile: { connect: { partyId_id: { partyId, id: profileId } } } } : {}),
          slotOrder,
        })) },
      },
    });
  });
}

export async function deletePartyComposition(partyId: string, id: string) {
  return prisma.$transaction(async (transaction) => {
    const referencedByRaid = await transaction.raid.findFirst({ where: { partyId, compositionId: id }, select: { id: true } });
    if (referencedByRaid) return { count: 0, inUse: true };
    const result = await transaction.partyComposition.deleteMany({ where: { id, partyId } });
    return { ...result, inUse: false };
  });
}
