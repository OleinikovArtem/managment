import "server-only";

import { PaymentOperationError } from "@/features/sales/payment-errors";
import { paymentInputSchema } from "@/features/sales/payment-schema";
import {
  listPartyPayments,
  registerPartyPayment,
} from "@/server/repositories/payment-repository";

export class PaymentInputError extends PaymentOperationError {
  constructor(message: string) {
    super(message);
    this.name = "PaymentInputError";
  }
}

export async function registerPayment(partyId: string, input: unknown) {
  const parsed = paymentInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new PaymentInputError(
      parsed.error.issues[0]?.message ?? "Проверьте данные выплаты.",
    );
  }

  const payment = await registerPartyPayment(partyId, {
    memberId: parsed.data.memberId,
    amount: BigInt(parsed.data.amount),
    paidAt: new Date(parsed.data.paidAt),
    comment: parsed.data.comment,
    idempotencyKey: parsed.data.idempotencyKey,
  });

  return {
    id: payment.id,
    memberId: payment.memberId,
    nicknameSnapshot: payment.nicknameSnapshot,
    amount: payment.amount.toString(),
    paidAt: payment.paidAt.toISOString(),
    allocations: payment.allocations.map((allocation) => ({
      saleShareId: allocation.saleShareId,
      amount: allocation.amount.toString(),
    })),
  };
}

export async function getPayments(partyId: string) {
  return listPartyPayments(partyId);
}
