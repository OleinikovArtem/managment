import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { RaidInput } from "@/features/raids/raid-schema";
import { RaidOperationError } from "@/features/raids/raid-errors";

type Transaction = Prisma.TransactionClient;

async function assertPartyReferences(
  transaction: Transaction,
  partyId: string,
  input: RaidInput,
) {
  const activeMembers = await transaction.partyMember.findMany({
    where: { partyId, isActive: true },
    select: { id: true, nickname: true, distributionWeight: true },
  });
  const submittedMemberIds = input.participants.map(({ memberId }) => memberId);
  const activeMemberIds = activeMembers.map(({ id }) => id);
  if (
    submittedMemberIds.length !== activeMemberIds.length ||
    activeMemberIds.some((id) => !submittedMemberIds.includes(id))
  ) {
    throw new RaidOperationError("Состав группы изменился. Обновите страницу и повторите попытку.");
  }

  const itemIds = [...new Set(input.lootDrops.map(({ itemId }) => itemId))];
  const items = itemIds.length
    ? await transaction.item.findMany({
        where: { id: { in: itemIds } },
        select: { id: true },
      })
    : [];
  if (items.length !== itemIds.length) {
    throw new RaidOperationError("Один или несколько предметов отсутствуют в общем каталоге.");
  }

  if (input.compositionId) {
    const composition = await transaction.partyComposition.findFirst({ where: { partyId, id: input.compositionId }, select: { id: true } });
    if (!composition) throw new RaidOperationError("Профиль состава не найден. Обновите страницу и повторите попытку.");
  }

  return activeMembers;
}

export async function listPartyRaids(partyId: string) {
  return prisma.raid.findMany({
    where: { partyId },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    include: {
      participants: { select: { status: true } },
      lootDrops: { select: { quantity: true } },
    },
  });
}

export async function listActivePartyMembers(partyId: string) {
  return prisma.partyMember.findMany({
    where: { partyId, isActive: true },
    orderBy: { nickname: "asc" },
    include: { profiles: { where: { isActive: true }, orderBy: { name: "asc" } } },
  });
}

export function listPartyCompositions(partyId: string) {
  return prisma.partyComposition.findMany({
    where: { partyId },
    include: { members: { include: { member: true, profile: true }, orderBy: { slotOrder: "asc" } } },
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
  });
}

export async function listPartyRaidItems(_partyId: string) {
  void _partyId;
  return prisma.item.findMany({
    orderBy: [{ normalizedName: "asc" }, { canonicalName: "asc" }],
    select: { id: true, canonicalName: true, displayName: true },
  });
}

export async function getPartyRaidById(partyId: string, raidId: string) {
  return prisma.raid.findFirst({
    where: { id: raidId, partyId },
    include: {
      participants: { orderBy: { nicknameSnapshot: "asc" } },
      lootDrops: {
        where: { partyId },
        include: {
          item: { select: { id: true, canonicalName: true, displayName: true } },
          saleTransactions: {
            include: { shares: { orderBy: { memberId: "asc" } } },
            orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export async function createPartyRaidRecord(partyId: string, input: RaidInput) {
  return prisma.$transaction(async (transaction) => {
    const activeMembers = await assertPartyReferences(transaction, partyId, input);
    const raid = await transaction.raid.create({
      data: {
        partyId,
        name: input.name,
        instanceName: input.instanceName || null,
        occurredAt: new Date(input.occurredAt),
        comment: input.comment || null,
        compositionId: input.compositionId || null,
      },
    });

    for (const attendance of input.participants) {
      const member = activeMembers.find(({ id }) => id === attendance.memberId);
      if (!member) {
        throw new RaidOperationError("Состав группы изменился. Обновите страницу и повторите попытку.");
      }
      const profile = attendance.profileId
        ? await transaction.partyMemberProfile.findFirst({ where: { partyId, id: attendance.profileId, memberId: member.id, isActive: true } })
        : null;
      if (attendance.profileId && !profile) throw new RaidOperationError("Профиль участника не найден. Обновите страницу и повторите попытку.");
      await transaction.raidParticipant.create({
        data: {
          partyId,
          raidId: raid.id,
          memberId: member.id,
          profileId: attendance.profileId || null,
          nicknameSnapshot: member.nickname,
          status: attendance.status,
          distributionWeight: 1,
          classSnapshot: profile?.className ?? null,
          roleSnapshot: profile?.role ?? null,
          profileSnapshot: profile?.name ?? null,
          levelSnapshot: profile?.level ?? null,
        },
      });
    }

    for (const lootDrop of input.lootDrops) {
      await transaction.lootDrop.create({
        data: {
          partyId,
          raidId: raid.id,
          itemId: lootDrop.itemId,
          quantity: lootDrop.quantity,
          comment: lootDrop.comment || null,
        },
      });
    }

    return raid.id;
  });
}

export async function updatePartyRaidRecord(
  partyId: string,
  raidId: string,
  input: RaidInput,
) {
  return prisma.$transaction(async (transaction) => {
    const raid = await transaction.raid.findFirst({
      where: { id: raidId, partyId },
      include: {
        participants: { select: { memberId: true } },
        lootDrops: { select: { id: true } },
      },
    });
    if (!raid) {
      return null;
    }

    const existingMemberIds = raid.participants.map(({ memberId }) => memberId);
    const submittedMemberIds = input.participants.map(({ memberId }) => memberId);
    if (
      existingMemberIds.length !== submittedMemberIds.length ||
      existingMemberIds.some((id) => !submittedMemberIds.includes(id))
    ) {
      throw new RaidOperationError("Исторический состав рейда нельзя менять.");
    }

    const existingLootIds = new Set(raid.lootDrops.map(({ id }) => id));
    for (const lootDrop of input.lootDrops) {
      if (lootDrop.id && !existingLootIds.has(lootDrop.id)) {
        throw new RaidOperationError("Запись о выпадении не найдена в этом рейде.");
      }
    }
    await assertPartyItemsExist(transaction, partyId, input);
    if (input.compositionId) {
      const composition = await transaction.partyComposition.findFirst({
        where: { partyId, id: input.compositionId },
        select: { id: true },
      });
      if (!composition) {
        throw new RaidOperationError("Профиль состава не найден. Обновите страницу и повторите попытку.");
      }
    }

    await transaction.raid.updateMany({
      where: { id: raidId, partyId },
      data: {
        name: input.name,
        instanceName: input.instanceName || null,
        occurredAt: new Date(input.occurredAt),
        comment: input.comment || null,
        compositionId: input.compositionId || null,
      },
    });

    for (const attendance of input.participants) {
      const member = attendance.profileId
        ? await transaction.partyMember.findFirst({ where: { partyId, id: attendance.memberId }, include: { profiles: { where: { isActive: true } } } })
        : null;
      const profile = attendance.profileId ? member?.profiles.find(({ id }) => id === attendance.profileId) : null;
      if (attendance.profileId && !profile) throw new RaidOperationError("Профиль участника не найден. Обновите страницу и повторите попытку.");
      const attendanceData = attendance.profileId
        ? { status: attendance.status, profileId: attendance.profileId, classSnapshot: profile?.className ?? null, roleSnapshot: profile?.role ?? null, profileSnapshot: profile?.name ?? null, levelSnapshot: profile?.level ?? null }
        : { status: attendance.status };
      const result = await transaction.raidParticipant.updateMany({
        where: { partyId, raidId, memberId: attendance.memberId },
        data: attendanceData,
      });
      if (result.count !== 1) {
        throw new RaidOperationError("Исторический состав рейда изменился. Обновите страницу.");
      }
    }

    for (const lootDrop of input.lootDrops) {
      const data = {
        itemId: lootDrop.itemId,
        quantity: lootDrop.quantity,
        comment: lootDrop.comment || null,
      };
      if (lootDrop.id) {
        const result = await transaction.lootDrop.updateMany({
          where: { id: lootDrop.id, partyId, raidId },
          data,
        });
        if (result.count !== 1) {
          throw new RaidOperationError("Запись о выпадении изменилась. Обновите страницу.");
        }
      } else {
        await transaction.lootDrop.create({
          data: { ...data, partyId, raidId },
        });
      }
    }

    return raidId;
  });
}

async function assertPartyItemsExist(
  transaction: Transaction,
  partyId: string,
  input: RaidInput,
) {
  const itemIds = [...new Set(input.lootDrops.map(({ itemId }) => itemId))];
  const items = itemIds.length
    ? await transaction.item.findMany({
        where: { id: { in: itemIds } },
        select: { id: true },
      })
    : [];
  if (items.length !== itemIds.length) {
    throw new RaidOperationError("Один или несколько предметов отсутствуют в общем каталоге.");
  }
}

export async function listPartyItemLootDrops(partyId: string, itemId: string) {
  return prisma.lootDrop.findMany({
    where: { partyId, itemId },
    include: {
      raid: { select: { id: true, name: true, instanceName: true, occurredAt: true } },
    },
    orderBy: [{ createdAt: "desc" }],
  });
}
