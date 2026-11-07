"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { raidIdSchema, raidInputSchema } from "@/features/raids/raid-schema";
import type { RaidActionResult } from "@/features/raids/raid-action-result";
import { RaidOperationError } from "@/features/raids/raid-errors";
import { StageConflictError } from "@/features/instances/catalog-schema";
import { requirePartyActionAccess } from "@/server/auth/party-access";
import { recordPartyAuditEvent } from "@/server/services/party-audit-service";
import { createRaid, updateRaid } from "@/server/services/raid-service";

function isForeignKeyConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003";
}

export async function createRaidAction(payload: unknown): Promise<RaidActionResult> {
  const parsed = raidInputSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Проверьте данные рейда.",
    };
  }

  const access = await requirePartyActionAccess("ADMIN");
  const { partyId } = access;
  try {
    const raidId = await createRaid(partyId, parsed.data);
    await recordPartyAuditEvent(access, {
      action: "CREATE",
      entityType: "raid",
      entityId: raidId,
      summary: `Добавил рейд «${parsed.data.name}» (${parsed.data.lootDrops.length} поступлений).`,
    });
    revalidatePath("/raids");
    revalidatePath("/dashboard");
    revalidatePath("/loot");
    return { ok: true, message: "Рейд сохранён.", raidId };
  } catch (error) {
    if (error instanceof StageConflictError)
      return { ok: false, message: error.message, stageConflict: true };
    if (error instanceof RaidOperationError) {
      return { ok: false, message: error.message };
    }
    if (isForeignKeyConstraintError(error)) {
      return {
        ok: false,
        message:
          "Связанный участник, рейд или предмет изменился. Обновите страницу и повторите попытку.",
      };
    }
    throw error;
  }
}

export async function updateRaidAction(
  raidIdValue: unknown,
  payload: unknown,
): Promise<RaidActionResult> {
  const raidId = raidIdSchema.safeParse(raidIdValue);
  const parsed = raidInputSchema.safeParse(payload);
  if (!raidId.success || !parsed.success) {
    return {
      ok: false,
      message: parsed.success
        ? "Некорректный идентификатор рейда."
        : (parsed.error.issues[0]?.message ?? "Проверьте данные рейда."),
    };
  }

  const access = await requirePartyActionAccess("ADMIN");
  const { partyId } = access;
  try {
    const updatedId = await updateRaid(partyId, raidId.data, parsed.data);
    await recordPartyAuditEvent(access, {
      action: "UPDATE",
      entityType: "raid",
      entityId: updatedId,
      summary: `Изменил рейд «${parsed.data.name}».`,
    });
    revalidatePath("/raids");
    revalidatePath(`/raids/${updatedId}`);
    revalidatePath("/loot");
    for (const itemId of new Set(parsed.data.lootDrops.map(({ itemId }) => itemId))) {
      revalidatePath(`/items/${itemId}`);
    }
    return { ok: true, message: "Изменения рейда сохранены.", raidId: updatedId };
  } catch (error) {
    if (error instanceof RaidOperationError) {
      return { ok: false, message: error.message };
    }
    if (isForeignKeyConstraintError(error)) {
      return {
        ok: false,
        message: "Связанная запись изменилась. Обновите страницу и повторите попытку.",
      };
    }
    throw error;
  }
}
