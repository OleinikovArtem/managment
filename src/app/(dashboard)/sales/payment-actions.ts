"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import {
  PaymentOperationError,
} from "@/features/sales/payment-errors";
import { paymentInputSchema } from "@/features/sales/payment-schema";
import type { PaymentActionResult } from "@/features/sales/payment-action-result";
import { ensureLocalWorkspace } from "@/server/bootstrap/local-workspace";
import { registerPayment } from "@/server/services/payment-service";

export async function registerPaymentAction(
  payload: unknown,
): Promise<PaymentActionResult> {
  const parsed = paymentInputSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Проверьте данные передачи Adena.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { partyId } = await ensureLocalWorkspace();
  try {
    const payment = await registerPayment(partyId, parsed.data);
    revalidatePath("/sales");
    revalidatePath("/dashboard");
    return { ok: true, message: "Передача Adena записана.", payment };
  } catch (error) {
    if (error instanceof PaymentOperationError) {
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
