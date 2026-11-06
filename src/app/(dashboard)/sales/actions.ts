"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { SaleOperationError } from "@/features/sales/sale-errors";
import { saleInputSchema } from "@/features/sales/sale-schema";
import type { SaleActionResult } from "@/features/sales/sale-action-result";
import { requirePartyActionAccess } from "@/server/auth/party-access";
import { registerSale } from "@/server/services/sale-service";
import { getLootDropAuditInfo } from "@/server/services/raid-service";
import { recordPartyAuditEvent } from "@/server/services/party-audit-service";

export async function registerSaleAction(payload: unknown): Promise<SaleActionResult> {
  const parsed = saleInputSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Проверьте данные продажи.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const access = await requirePartyActionAccess("ADMIN");
  const { partyId } = access;
  try {
    const context = await getLootDropAuditInfo(partyId, parsed.data.lootDropId);
    const sale = await registerSale(partyId, parsed.data);
    const itemName = context?.item.displayName || context?.item.canonicalName || "предмет";
    await recordPartyAuditEvent(access, { action: "CREATE", entityType: "sale", entityId: sale.id, summary: `Отметил продажу: ${itemName} × ${sale.quantitySold} за ${new Intl.NumberFormat("ru-RU").format(BigInt(sale.totalPrice))} Adena.` });
    revalidatePath("/sales");
    revalidatePath("/ledger");
    revalidatePath("/dashboard");
    revalidatePath("/raids");
    revalidatePath("/loot");
    return { ok: true, message: "Продажа записана, доли Adena рассчитаны.", sale };
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
