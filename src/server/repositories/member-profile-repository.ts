import "server-only";

import { prisma } from "@/lib/db/prisma";
import type { MemberProfileInput, MemberProfileUpdateInput } from "@/features/members/member-profile-schema";

export function listPartyMemberProfiles(partyId: string) {
  return prisma.partyMemberProfile.findMany({
    where: { partyId, isActive: true },
    orderBy: [{ memberId: "asc" }, { name: "asc" }],
  });
}

export async function createPartyMemberProfile(partyId: string, input: MemberProfileInput) {
  const member = await prisma.partyMember.findFirst({ where: { partyId, id: input.memberId, isActive: true }, select: { id: true } });
  if (!member) throw new Error("Участник не найден или деактивирован.");
  return prisma.partyMemberProfile.create({
    data: {
      partyId,
      memberId: input.memberId,
      name: input.name,
      className: input.className,
      role: input.role || null,
      level: input.level ?? null,
      note: input.note || null,
    },
  });
}

export function deletePartyMemberProfile(partyId: string, id: string) {
  return prisma.partyMemberProfile.updateMany({ where: { partyId, id }, data: { isActive: false } });
}

export async function updatePartyMemberProfile(partyId: string, id: string, input: MemberProfileUpdateInput) {
  const result = await prisma.partyMemberProfile.updateMany({
    where: { partyId, id, isActive: true },
    data: { name: input.name, className: input.className, role: input.role || null, level: input.level ?? null, note: input.note || null },
  });
  return result.count === 1;
}
