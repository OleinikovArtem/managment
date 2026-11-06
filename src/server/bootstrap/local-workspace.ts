import "server-only";

import { PartyRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { ensureBaseItemCatalog } from "@/server/bootstrap/base-item-catalog";

const LOCAL_USER_ID = "local-user";

export type LocalWorkspace = {
  partyId: string;
  partyName: string;
};

export async function ensureLocalWorkspace(): Promise<LocalWorkspace> {
  return prisma.$transaction(async (transaction) => {
    const user = await transaction.user.upsert({
      where: { id: LOCAL_USER_ID },
      update: {},
      create: {
        id: LOCAL_USER_ID,
        displayName: "Local user",
      },
    });

    const memberships = await transaction.partyMembership.findMany({
      where: { userId: user.id },
      include: { party: true },
    });

    if (memberships.length > 1) {
      throw new Error(
        "Инициализация обнаружила несколько членств локального пользователя.",
      );
    }

    const membership = memberships[0];
    if (membership) {
      if (membership.role !== PartyRole.OWNER) {
        throw new Error(
          "Локальный пользователь должен быть владельцем группы.",
        );
      }

      await ensureBaseItemCatalog(transaction);

      return {
        partyId: membership.partyId,
        partyName: membership.party.name,
      };
    }

    if ((await transaction.party.count()) > 0) {
      throw new Error(
        "Группа существует без членства локального владельца. Данные не изменены.",
      );
    }

    const party = await transaction.party.create({
      data: { name: "Моя группа" },
    });

    await transaction.partyMembership.create({
      data: {
        partyId: party.id,
        userId: user.id,
        role: PartyRole.OWNER,
      },
    });

    await ensureBaseItemCatalog(transaction);

    return {
      partyId: party.id,
      partyName: party.name,
    };
  });
}
