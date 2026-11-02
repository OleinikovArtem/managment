"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { SaleOperationError } from "@/features/sales/sale-errors";
import { saleInputSchema } from "@/features/sales/sale-schema";
import type { SaleActionResult } from "@/features/sales/sale-action-result";
import { ensureLocalWorkspace } from "@/server/bootstrap/local-workspace";
import { registerSale } from "@/server/services/sale-service";

export async function registerSaleAction(payload: unknown): Promise<SaleActionResult> {
  const parsed = saleInputSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Проверьте данные продажи.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { partyId } = await ensureLocalWorkspace();
  try {
    const sale = await registerSale(partyId, parsed.data);
    revalidatePath("/sales");
    revalidatePath("/dashboard");
    revalidatePath("/raids");
    return { ok: true, message: "Продажа и распределение Adena проведены.", sale };
  } catch (error) {
    if (error instanceof SaleOperationError) {
      return { ok: false, message: error.message };
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2003" || error.code === "P2004")
    ) {
      return {
        ok: false,
        message: "Операция нарушает ограничение целостности данных и не была проведена.",
      };
    }
    throw error;
  }
}
