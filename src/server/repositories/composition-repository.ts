import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { CompositionInput } from "@/features/compositions/composition-schema";

type Transaction = Prisma.TransactionClient;

export function listPartyCompositions(partyId: string) {
  return prisma.partyComposition.findMany({
    where: { partyId },
    include: {
      members: { include: { member: true, profile: true }, orderBy: { slotOrder: "asc" } },
    },
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
  });
}

export function getPartyComposition(partyId: string, id: string) {
  return prisma.partyComposition.findFirst({
    where: { partyId, id },
    include: {
      members: { include: { member: true, profile: true }, orderBy: { slotOrder: "asc" } },
    },
  });
}

async function assertCompositionSlots(
  transaction: Transaction,
  partyId: string,
  input: CompositionInput,
  preserveCompositionId?: string,
) {
  const memberIds = input.slots.map(({ memberId }) => memberId);
  if (memberIds.length !== new Set(memberIds).size)
    throw new Error("Выберите каждого участника состава только один раз.");
  const members = await transaction.partyMember.findMany({
    where: { partyId, id: { in: memberIds }, isActive: true },
    select: {
      id: true,
      className: true,
      profiles: { where: { isActive: true }, select: { className: true } },
    },
  });
  const retainedSlots = preserveCompositionId
    ? await transaction.partyCompositionMember.findMany({
        where: { partyId, compositionId: preserveCompositionId },
        select: { memberId: true, profileId: true, classOverride: true },
      })
    : [];
  if (
    memberIds.some(
      (memberId) =>
        !members.some((member) => member.id === memberId) &&
        !retainedSlots.some((slot) => slot.memberId === memberId),
    )
  )
    throw new Error("Выберите только активных участников этой группы.");
  const profileIds = input.slots.flatMap(({ profileId }) => (profileId ? [profileId] : []));
  if (profileIds.length) {
    const profiles = await transaction.partyMemberProfile.findMany({
      where: { partyId, id: { in: profileIds }, isActive: true },
      select: { id: true, memberId: true },
    });
    if (
      input.slots.some(({ memberId, profileId }) => {
        if (!profileId) return false;
        const activeAndOwned = profiles.some(
          (profile) => profile.id === profileId && profile.memberId === memberId,
        );
        const retained = retainedSlots.some(
          (slot) => slot.profileId === profileId && slot.memberId === memberId,
        );
        return !activeAndOwned && !retained;
      })
    ) {
      throw new Error("Выберите профиль, принадлежащий выбранному участнику.");
    }
  }
  for (const slot of input.slots) {
    if (!slot.classOverride) continue;
    const member = members.find(({ id }) => id === slot.memberId);
    const retainedOverride = retainedSlots.some(
      (previous) =>
        previous.memberId === slot.memberId && previous.classOverride === slot.classOverride,
    );
    if (!member) {
      if (retainedOverride) continue;
      throw new Error("Выберите только активных участников этой группы.");
    }
    const selectedClass = slot.classOverride.trim().toLocaleLowerCase();
    if (
      [member.className, ...member.profiles.map((profile) => profile.className)].some(
        (className) => className?.trim().toLocaleLowerCase() === selectedClass,
      ) &&
      !retainedOverride
    ) {
      throw new Error("Профессия уже сохранена у участника. Выберите Main или Subclass.");
    }
  }
}

export async function createPartyComposition(partyId: string, input: CompositionInput) {
  return prisma.$transaction(async (transaction) => {
    await assertCompositionSlots(transaction, partyId, input);
    return transaction.partyComposition.create({
      data: {
        partyId,
        name: input.name,
        description: input.description || null,
        focus: input.focus || null,
        maxMembers: 36,
        members: {
          create: input.slots.map(({ memberId, profileId, classOverride }, slotOrder) => ({
            member: { connect: { partyId_id: { partyId, id: memberId } } },
            ...(profileId
              ? { profile: { connect: { partyId_id: { partyId, id: profileId } } } }
              : {}),
            ...(classOverride ? { classOverride } : {}),
            slotOrder,
          })),
        },
      },
    });
  });
}

export async function updatePartyComposition(partyId: string, id: string, input: CompositionInput) {
  return prisma.$transaction(async (transaction) => {
    await assertCompositionSlots(transaction, partyId, input, id);
    const updated = await transaction.partyComposition.updateMany({
      where: { partyId, id },
      data: {
        name: input.name,
        description: input.description || null,
        focus: input.focus || null,
      },
    });
    if (updated.count !== 1) return false;
    await transaction.partyCompositionMember.deleteMany({ where: { partyId, compositionId: id } });
    await transaction.partyCompositionMember.createMany({
      data: input.slots.map(({ memberId, profileId, classOverride }, slotOrder) => ({
        partyId,
        compositionId: id,
        memberId,
        profileId: profileId ?? null,
        classOverride: classOverride ?? null,
        slotOrder,
      })),
    });
    return true;
  });
}

export async function deletePartyComposition(partyId: string, id: string) {
  return prisma.$transaction(async (transaction) => {
    const referencedByRaid = await transaction.raid.findFirst({
      where: { partyId, compositionId: id },
      select: { id: true },
    });
    if (referencedByRaid) return { count: 0, inUse: true };
    const result = await transaction.partyComposition.deleteMany({ where: { id, partyId } });
    return { ...result, inUse: false };
  });
}
