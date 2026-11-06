import "server-only";

import { prisma } from "@/lib/db/prisma";
import type { MemberInput } from "@/features/members/member-schema";
import { syncMemberSubclasses } from "./member-subclass-repository";

export async function listPartyMembers(partyId: string) {
  return prisma.partyMember.findMany({
    where: { partyId },
    orderBy: [{ isActive: "desc" }, { nickname: "asc" }],
  });
}

export async function createPartyMemberRecord(
  partyId: string,
  input: MemberInput,
  normalizedNickname: string,
) {
  return prisma.$transaction(async tx => {
  const member = await tx.partyMember.create({
    data: {
      partyId,
      nickname: input.nickname,
      normalizedNickname,
      distributionWeight: 1,
      comment: input.comment || null,
      className: input.className || null,
      level: input.level ?? null,
      role: input.role || null,
    },
  });
  if (input.subclasses !== undefined) await syncMemberSubclasses(tx, partyId, member.id, input.subclasses);
  return member;
  });
}

export async function updatePartyMemberRecord(
  partyId: string,
  memberId: string,
  input: MemberInput,
  normalizedNickname: string,
) {
  return prisma.$transaction(async tx => {
  await tx.$queryRaw`SELECT id FROM "PartyMember" WHERE "partyId" = ${partyId} AND id = ${memberId} FOR UPDATE`;
  const result = await tx.partyMember.updateMany({
    where: { id: memberId, partyId },
    data: {
      nickname: input.nickname,
      normalizedNickname,
      distributionWeight: 1,
      comment: input.comment || null,
      className: input.className || null,
      ...(input.level !== undefined ? { level: input.level } : {}),
      role: input.role || null,
    },
  });

  if (result.count !== 1) {
    return null;
  }

  if (input.subclasses !== undefined) await syncMemberSubclasses(tx, partyId, memberId, input.subclasses);
  return tx.partyMember.findFirst({
    where: { id: memberId, partyId },
  });
  });
}

export async function deactivatePartyMemberRecord(
  partyId: string,
  memberId: string,
) {
  const result = await prisma.partyMember.updateMany({
    where: { id: memberId, partyId, isActive: true },
    data: { isActive: false },
  });

  if (result.count !== 1) {
    return null;
  }

  return prisma.partyMember.findFirst({
    where: { id: memberId, partyId },
  });
}
