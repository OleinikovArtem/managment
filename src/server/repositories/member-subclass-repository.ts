import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { MemberInput } from "@/features/members/member-schema";
import { MemberClassesError } from "@/features/members/member-class-errors";

export async function syncMemberSubclasses(tx: Prisma.TransactionClient, partyId: string, memberId: string, input: NonNullable<MemberInput["subclasses"]>) {
  const profiles = await tx.partyMemberProfile.findMany({ where: { partyId, memberId } });
  if (profiles.filter(profile => profile.isActive).length > 4) throw new MemberClassesError("У персонажа больше четырёх старых профилей. Сначала отключите лишние профили ниже.");
  for (const entry of input) {
    if (entry.id && !profiles.some(profile => profile.id === entry.id && profile.isActive)) throw new MemberClassesError("Профили изменились. Обновите страницу и повторите.");
  }
  const chosen = input.filter(entry => entry.className);
  const planned = chosen.map(entry => ({ entry, profile: entry.id ? profiles.find(profile => profile.id === entry.id) : profiles.find(profile => profile.subclassSlot === entry.slot) }));
  const keepIds = planned.flatMap(({ profile }) => profile ? [profile.id] : []);
  if (new Set(keepIds).size !== keepIds.length) throw new MemberClassesError("Один профиль нельзя использовать в двух слотах.");
  const archiveIds = profiles.filter(profile => profile.isActive && !keepIds.includes(profile.id)).map(profile => profile.id);
  if (archiveIds.length) {
    await tx.partyCompositionMember.updateMany({ where: { partyId, profileId: { in: archiveIds } }, data: { profileId: null } });
    await tx.partyMemberProfile.updateMany({ where: { partyId, memberId, id: { in: archiveIds } }, data: { isActive: false } });
  }
  // Clear slot assignments before applying the new mapping to allow swaps.
  await tx.partyMemberProfile.updateMany({ where: { partyId, memberId }, data: { subclassSlot: null } });
  const names = new Set(profiles.map(profile => profile.name));
  for (const { entry, profile } of planned) {
    if (profile) {
      await tx.partyMemberProfile.update({ where: { id: profile.id }, data: { className: entry.className, subclassSlot: entry.slot, isActive: true } });
    } else {
      const base = `Subclass ${entry.slot}`;
      let name = base;
      for (let suffix = 2; names.has(name); suffix++) name = `${base} (${suffix})`;
      names.add(name);
      await tx.partyMemberProfile.create({ data: { partyId, memberId, name, className: entry.className, subclassSlot: entry.slot } });
    }
  }
}
