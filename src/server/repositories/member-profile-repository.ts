import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import type {
  MemberProfileInput,
  MemberProfileUpdateInput,
} from "@/features/members/member-profile-schema";
import { MemberClassesError } from "@/features/members/member-class-errors";

export function listPartyMemberProfiles(partyId: string) {
  return prisma.partyMemberProfile.findMany({
    where: { partyId, isActive: true },
    orderBy: [{ memberId: "asc" }, { subclassSlot: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });
}

export async function createPartyMemberProfile(partyId: string, input: MemberProfileInput) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "PartyMember" WHERE "partyId" = ${partyId} AND id = ${input.memberId} FOR UPDATE`;
    const member = await tx.partyMember.findFirst({
      where: { partyId, id: input.memberId, isActive: true },
      select: { id: true },
    });
    if (!member) throw new Error("Участник не найден или деактивирован.");
    const active = await tx.partyMemberProfile.findMany({
      where: { partyId, memberId: input.memberId, isActive: true },
      select: { subclassSlot: true },
    });
    if (active.length >= 4)
      throw new MemberClassesError("Можно добавить не больше четырёх Subclass.");
    const subclassSlot = [1, 2, 3, 4].find(
      (slot) => !active.some((profile) => profile.subclassSlot === slot),
    )!;
    await tx.partyMemberProfile.updateMany({
      where: { partyId, memberId: input.memberId, isActive: false, subclassSlot },
      data: { subclassSlot: null },
    });
    return tx.partyMemberProfile.create({
      data: {
        partyId,
        memberId: input.memberId,
        name: input.name,
        className: input.className,
        subclassSlot,
        role: input.role || null,
        level: input.level ?? null,
        note: input.note || null,
      },
    });
  });
}

export async function deletePartyMemberProfile(partyId: string, id: string) {
  return prisma.$transaction(async (tx) => {
    const profile = await tx.partyMemberProfile.findFirst({
      where: { partyId, id },
      select: { memberId: true },
    });
    if (!profile) return { count: 0 };
    await tx.$queryRaw`SELECT id FROM "PartyMember" WHERE "partyId" = ${partyId} AND id = ${profile.memberId} FOR UPDATE`;
    await tx.partyCompositionMember.updateMany({
      where: { partyId, profileId: id },
      data: { profileId: null },
    });
    return tx.partyMemberProfile.updateMany({ where: { partyId, id }, data: { isActive: false } });
  });
}

export async function updatePartyMemberProfile(
  partyId: string,
  id: string,
  input: MemberProfileUpdateInput,
) {
  try {
    return await prisma.$transaction(async (tx) => {
      const initial = await tx.partyMemberProfile.findFirst({
        where: { partyId, id, isActive: true },
        select: { memberId: true },
      });
      if (!initial) return { status: "not-found" as const };
      await tx.$queryRaw`SELECT id FROM "PartyMember" WHERE "partyId" = ${partyId} AND id = ${initial.memberId} FOR UPDATE`;
      const current = await tx.partyMemberProfile.findFirst({
        where: { partyId, id, isActive: true },
        select: { updatedAt: true },
      });
      if (!current) return { status: "not-found" as const };
      if (current.updatedAt.getTime() !== new Date(input.expectedUpdatedAt).getTime())
        return { status: "stale" as const };
      const result = await tx.partyMemberProfile.updateMany({
        where: { partyId, id, isActive: true, updatedAt: current.updatedAt },
        data: {
          name: input.name,
          className: input.className,
          role: input.role || null,
          ...(input.level !== undefined ? { level: input.level } : {}),
          note: input.note || null,
          updatedAt: new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1)),
        },
      });
      return result.count === 1 ? { status: "updated" as const } : { status: "stale" as const };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      throw new Error("Профиль с таким названием уже существует у участника.");
    throw error;
  }
}
