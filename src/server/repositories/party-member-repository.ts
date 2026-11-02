import "server-only";

import { prisma } from "@/lib/db/prisma";
import type { MemberInput } from "@/features/members/member-schema";

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
  return prisma.partyMember.create({
    data: {
      partyId,
      nickname: input.nickname,
      normalizedNickname,
      distributionWeight: input.distributionWeight,
      comment: input.comment || null,
    },
  });
}

export async function updatePartyMemberRecord(
  partyId: string,
  memberId: string,
  input: MemberInput,
  normalizedNickname: string,
) {
  const result = await prisma.partyMember.updateMany({
    where: { id: memberId, partyId },
    data: {
      nickname: input.nickname,
      normalizedNickname,
      distributionWeight: input.distributionWeight,
      comment: input.comment || null,
    },
  });

  if (result.count !== 1) {
    return null;
  }

  return prisma.partyMember.findFirst({
    where: { id: memberId, partyId },
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
