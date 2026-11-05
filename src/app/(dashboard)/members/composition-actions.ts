"use server";

import { revalidatePath } from "next/cache";
import { ensureLocalWorkspace } from "@/server/bootstrap/local-workspace";
import { compositionIdSchema, compositionInputSchema } from "@/features/compositions/composition-schema";
import type { CompositionActionResult } from "@/features/compositions/composition-action-result";
import { createPartyComposition, deletePartyComposition } from "@/server/repositories/composition-repository";

export async function createCompositionAction(payload: unknown): Promise<CompositionActionResult> {
  const parsed = compositionInputSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: "Проверьте данные состава.", fieldErrors: parsed.error.flatten().fieldErrors };
  const { partyId } = await ensureLocalWorkspace();
  try { await createPartyComposition(partyId, parsed.data); } catch (error) {
    if (error instanceof Error && error.message.startsWith("Выберите")) return { ok: false, message: error.message };
    return { ok: false, message: "Не удалось сохранить состав. Проверьте выбранных участников и профили и повторите." };
  }
  revalidatePath("/members"); revalidatePath("/compositions"); revalidatePath("/raids/new");
  return { ok: true, message: "Профиль состава сохранён." };
}

export async function deleteCompositionAction(idValue: unknown): Promise<CompositionActionResult> {
  const id = compositionIdSchema.safeParse(idValue);
  if (!id.success) return { ok: false, message: "Некорректный состав." };
  const { partyId } = await ensureLocalWorkspace();
  const result = await deletePartyComposition(partyId, id.data);
  if (result.inUse) return { ok: false, message: "Этот состав уже использован в рейде. Он сохранён, чтобы история рейда оставалась целостной." };
  if (result.count !== 1) return { ok: false, message: "Состав не найден." };
  revalidatePath("/members"); revalidatePath("/compositions"); revalidatePath("/raids/new");
  return { ok: true, message: "Профиль состава удалён." };
}
