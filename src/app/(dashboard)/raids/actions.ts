"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { raidIdSchema, raidInputSchema } from "@/features/raids/raid-schema";
import type { RaidActionResult } from "@/features/raids/raid-action-result";
import { RaidOperationError } from "@/features/raids/raid-errors";
import { ensureLocalWorkspace } from "@/server/bootstrap/local-workspace";
import {
  createRaid,
  updateRaid,
} from "@/server/services/raid-service";

function isForeignKeyConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003"
  );
}

export async function createRaidAction(payload: unknown): Promise<RaidActionResult> {
  const parsed = raidInputSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Проверьте данные рейда.",
    };
  }

  const { partyId } = await ensureLocalWorkspace();
  try {
    const raidId = await createRaid(partyId, parsed.data);
    revalidatePath("/raids");
    revalidatePath("/dashboard");
    return { ok: true, message: "Рейд сохранён.", raidId };
  } catch (error) {
    if (error instanceof RaidOperationError) {
      return { ok: false, message: error.message };
    }
    if (isForeignKeyConstraintError(error)) {
      return {
        ok: false,
        message: "Связанный участник, рейд или предмет изменился. Обновите страницу и повторите попытку.",
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
        : parsed.error.issues[0]?.message ?? "Проверьте данные рейда.",
    };
  }

  const { partyId } = await ensureLocalWorkspace();
  try {
    const updatedId = await updateRaid(partyId, raidId.data, parsed.data);
    revalidatePath("/raids");
    revalidatePath(`/raids/${updatedId}`);
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
