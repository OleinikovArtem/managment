import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { RaidInput } from "@/features/raids/raid-schema";
import { RaidOperationError } from "@/features/raids/raid-errors";
import { createHash } from "node:crypto";
import { lockParty, lockStages } from "./catalog-locks";
import { assertDraftStage } from "./instance-repository";
import { selectableCatalog, visibleCatalog } from "./catalog-scope";

type Transaction = Prisma.TransactionClient;

async function assertPartyReferences(transaction: Transaction, partyId: string, input: RaidInput) {
  const activeMembers = await transaction.partyMember.findMany({
    where: { partyId, isActive: true },
    select: {
      id: true,
      nickname: true,
      distributionWeight: true,
      className: true,
      role: true,
      level: true,
    },
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
        where: { id: { in: itemIds }, ...selectableCatalog(partyId) },
        select: { id: true },
      })
    : [];
  if (items.length !== itemIds.length) {
    throw new RaidOperationError("Один или несколько предметов отсутствуют в общем каталоге.");
  }

  if (input.compositionId) {
    const composition = await transaction.partyComposition.findFirst({
      where: { partyId, id: input.compositionId },
      select: { id: true },
    });
    if (!composition)
      throw new RaidOperationError(
        "Профиль состава не найден. Обновите страницу и повторите попытку.",
      );
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
    include: {
      members: { include: { member: true, profile: true }, orderBy: { slotOrder: "asc" } },
    },
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
  });
}

export async function listPartyRaidItems(partyId: string) {
  return prisma.item.findMany({
    orderBy: [{ normalizedName: "asc" }, { canonicalName: "asc" }],
    where: selectableCatalog(partyId),
    take: 40,
    select: {
      id: true,
      canonicalName: true,
      displayName: true,
      category: true,
      partyId: true,
      isActive: true,
    },
  });
}

export async function getPartyRaidById(partyId: string, raidId: string) {
  return prisma.raid.findFirst({
    where: { id: raidId, partyId },
    include: {
      participants: {
        orderBy: { nicknameSnapshot: "asc" },
        include: {
          member: { select: { className: true, role: true, level: true } },
          profile: { select: { subclassSlot: true } },
        },
      },
      lootDrops: {
        where: { partyId },
        include: {
          item: { select: { id: true, canonicalName: true, displayName: true, category: true } },
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

export async function getLootDropAuditContext(partyId: string, lootDropId: string) {
  return prisma.lootDrop.findFirst({
    where: { partyId, id: lootDropId },
    select: {
      quantity: true,
      item: { select: { displayName: true, canonicalName: true } },
      raid: { select: { name: true } },
    },
  });
}

export async function createPartyRaidRecord(partyId: string, input: RaidInput) {
  return prisma.$transaction(
    async (transaction) => {
      await lockStages(transaction);
      await lockParty(transaction, partyId);
      if (!input.creationKey) throw new RaidOperationError("Обновите форму создания рейда.");
      const hash = createHash("sha256")
        .update(
          JSON.stringify({
            ...input,
            participants: [...input.participants].sort((a, b) =>
              a.memberId.localeCompare(b.memberId),
            ),
          }),
        )
        .digest("hex");
      const existing = await transaction.raid.findUnique({
        where: { partyId_creationKey: { partyId, creationKey: input.creationKey } },
      });
      if (existing) {
        if (existing.creationPayloadHash !== hash)
          throw new RaidOperationError("Этот запрос уже создал рейд с другими данными.");
        return existing.id;
      }
      const stage = await assertDraftStage(transaction, {
        stageId: input.stageId ?? null,
        revision: input.stageRevision ?? null,
      });
      const instance = input.instanceId
        ? await transaction.instance.findFirst({
            where: { id: input.instanceId, ...selectableCatalog(partyId) },
          })
        : null;
      if (input.instanceId && !instance)
        throw new RaidOperationError("Инстанс недоступен. Выберите другой, черновик сохранён.");
      const activeMembers = await assertPartyReferences(transaction, partyId, input);
      const raid = await transaction.raid.create({
        data: {
          partyId,
          name: input.name || instance?.displayName || input.instanceName || "Рейд",
          instanceId: instance?.id ?? null,
          instanceName: instance?.displayName ?? (input.instanceName || null),
          stageId: stage?.id ?? null,
          stageCodeSnapshot: stage?.code ?? null,
          stageNameSnapshot: stage?.name ?? null,
          stageRevisionSnapshot: stage?.revision ?? null,
          creationKey: input.creationKey,
          creationPayloadHash: hash,
          occurredAt: new Date(input.occurredAt),
          comment: input.comment || null,
          compositionId: input.compositionId || null,
        },
      });

      for (const attendance of input.participants) {
        const member = activeMembers.find(({ id }) => id === attendance.memberId);
        if (!member) {
          throw new RaidOperationError(
            "Состав группы изменился. Обновите страницу и повторите попытку.",
          );
        }
        const profile = attendance.profileId
          ? await transaction.partyMemberProfile.findFirst({
              where: { partyId, id: attendance.profileId, memberId: member.id, isActive: true },
            })
          : null;
        if (attendance.profileId && !profile)
          throw new RaidOperationError(
            "Профиль участника не найден. Обновите страницу и повторите попытку.",
          );
        await transaction.raidParticipant.create({
          data: {
            partyId,
            raidId: raid.id,
            memberId: member.id,
            profileId: attendance.profileId || null,
            nicknameSnapshot: member.nickname,
            status: attendance.status,
            distributionWeight: 1,
            classSnapshot: profile ? profile.className : member.className,
            roleSnapshot: profile ? profile.role : member.role,
            profileSnapshot: profile?.name ?? null,
            levelSnapshot: profile ? profile.level : member.level,
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
    },
    { timeout: 25_000, maxWait: 10_000 },
  );
}

export async function updatePartyRaidRecord(partyId: string, raidId: string, input: RaidInput) {
  return prisma.$transaction(
    async (transaction) => {
      await lockParty(transaction, partyId);
      await transaction.$queryRaw`SELECT id FROM "Raid" WHERE id=${raidId} AND "partyId"=${partyId} FOR UPDATE`;
      const raid = await transaction.raid.findFirst({
        where: { id: raidId, partyId },
        include: {
          participants: { select: { memberId: true, profileId: true } },
          lootDrops: { select: { id: true, itemId: true } },
          _count: { select: { saleTransactions: true } },
        },
      });
      if (!raid) {
        return null;
      }
      if (raid.lockedAt || raid._count.saleTransactions)
        throw new RaidOperationError(
          "В рейде уже началась продажа. Состав и добыча заблокированы.",
        );
      if ((input.stageId ?? null) !== raid.stageId)
        throw new RaidOperationError("Историческую стадию рейда менять нельзя.");
      const instance = input.instanceId
        ? await transaction.instance.findFirst({
            where: {
              id: input.instanceId,
              ...visibleCatalog(partyId),
              ...(input.instanceId === raid.instanceId ? {} : { isActive: true }),
            },
          })
        : null;
      if (input.instanceId && !instance) throw new RaidOperationError("Инстанс недоступен.");

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
      const freshItemIds = [
        ...new Set(
          input.lootDrops
            .filter(
              (row) =>
                !row.id ||
                raid.lootDrops.find((previous) => previous.id === row.id)?.itemId !== row.itemId,
            )
            .map((row) => row.itemId),
        ),
      ];
      if (
        freshItemIds.length &&
        (await transaction.item.count({
          where: { id: { in: freshItemIds }, ...selectableCatalog(partyId) },
        })) !== freshItemIds.length
      )
        throw new RaidOperationError("Новый предмет недоступен или находится в архиве.");
      if (input.compositionId) {
        const composition = await transaction.partyComposition.findFirst({
          where: { partyId, id: input.compositionId },
          select: { id: true },
        });
        if (!composition) {
          throw new RaidOperationError(
            "Профиль состава не найден. Обновите страницу и повторите попытку.",
          );
        }
      }

      await transaction.raid.updateMany({
        where: { id: raidId, partyId },
        data: {
          name: input.name || instance?.displayName || input.instanceName || "Рейд",
          instanceId: instance?.id ?? null,
          instanceName:
            input.instanceId === raid.instanceId
              ? raid.instanceName
              : (instance?.displayName ?? (input.instanceName || null)),
          occurredAt: new Date(input.occurredAt),
          comment: input.comment || null,
          compositionId: input.compositionId || null,
        },
      });

      for (const attendance of input.participants) {
        const previous = raid.participants.find((row) => row.memberId === attendance.memberId);
        const changedProfile = (previous?.profileId ?? null) !== (attendance.profileId ?? null);
        const member = changedProfile
          ? await transaction.partyMember.findFirst({
              where: { partyId, id: attendance.memberId },
              include: { profiles: { where: { isActive: true } } },
            })
          : null;
        const profile = attendance.profileId
          ? member?.profiles.find(({ id }) => id === attendance.profileId)
          : null;
        if (changedProfile && (!member || (attendance.profileId && !profile)))
          throw new RaidOperationError(
            "Профиль участника не найден. Обновите страницу и повторите попытку.",
          );
        const attendanceData = changedProfile
          ? {
              status: attendance.status,
              profileId: attendance.profileId || null,
              classSnapshot: profile ? profile.className : member?.className,
              roleSnapshot: profile ? profile.role : member?.role,
              profileSnapshot: profile?.name ?? null,
              levelSnapshot: profile ? profile.level : member?.level,
            }
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
    },
    { timeout: 25_000, maxWait: 10_000 },
  );
}

async function assertPartyItemsExist(transaction: Transaction, partyId: string, input: RaidInput) {
  const itemIds = [...new Set(input.lootDrops.map(({ itemId }) => itemId))];
  const items = itemIds.length
    ? await transaction.item.findMany({
        where: { id: { in: itemIds }, ...visibleCatalog(partyId) },
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
