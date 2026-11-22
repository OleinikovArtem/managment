"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { PaymentOperationError } from "@/features/sales/payment-errors";
import { paymentInputSchema } from "@/features/sales/payment-schema";
import type { PaymentActionResult } from "@/features/sales/payment-action-result";
import { requirePartyActionAccess } from "@/server/auth/party-access";
import { correctPayment, registerPayment } from "@/server/services/payment-service";
import { recordPartyAuditEvent } from "@/server/services/party-audit-service";

export async function registerPaymentAction(payload: unknown): Promise<PaymentActionResult> {
  const parsed = paymentInputSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Проверьте данные передачи Adena.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const access = await requirePartyActionAccess("ADMIN");
  const { partyId } = access;
  try {
    const payment = await registerPayment(partyId, parsed.data);
    await recordPartyAuditEvent(access, {
      action: "CREATE",
      entityType: "payment",
      entityId: payment.id,
      summary: `Передал ${new Intl.NumberFormat("ru-RU").format(BigInt(payment.amount))} Adena участнику ${payment.nicknameSnapshot}.`,
    });
    revalidatePath("/sales");
    revalidatePath("/ledger");
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

export async function correctPaymentAction(
  paymentIdValue: unknown,
  correction: unknown,
): Promise<{ ok: boolean; message: string }> {
  const access = await requirePartyActionAccess("ADMIN");
  const paymentId = z.string().trim().min(1).safeParse(paymentIdValue);
  const parsed = paymentInputSchema.nullable().safeParse(correction);
  if (!paymentId.success || !parsed.success) {
    return {
      ok: false,
      message: parsed.error?.issues[0]?.message ?? "Проверьте данные передачи Adena.",
    };
  }

  try {
    const { original, replacement, changed } = await correctPayment(
      access.partyId,
      paymentId.data,
      parsed.data ?? undefined,
    );
    if (changed) {
      const format = (amount: bigint) => amount.toLocaleString("ru-RU");
      await recordPartyAuditEvent(access, {
        action: replacement ? "UPDATE" : "DELETE",
        entityType: "payment",
        entityId: original.id,
        summary: replacement
          ? `Исправил передачу: ${format(original.amount)} Adena · ${original.nicknameSnapshot} → ${format(replacement.amount)} Adena · ${replacement.nicknameSnapshot}.`
          : `Удалил передачу ${format(original.amount)} Adena участнику ${original.nicknameSnapshot}.`,
      });
    }
    revalidatePath("/sales");
    revalidatePath("/ledger");
    revalidatePath("/dashboard");
    return { ok: true, message: replacement ? "Передача исправлена." : "Передача удалена." };
  } catch (error) {
    if (error instanceof PaymentOperationError) return { ok: false, message: error.message };
    throw error;
  }
}
