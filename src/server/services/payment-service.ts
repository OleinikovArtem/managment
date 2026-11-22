import "server-only";

import { PaymentOperationError } from "@/features/sales/payment-errors";
import { paymentInputSchema, type PaymentInput } from "@/features/sales/payment-schema";
import {
  correctPartyPayment,
  listPartyPayments,
  registerPartyPayment,
} from "@/server/repositories/payment-repository";

function toRecordInput(input: PaymentInput) {
  return { ...input, amount: BigInt(input.amount), paidAt: new Date(input.paidAt) };
}

export class PaymentInputError extends PaymentOperationError {
  constructor(message: string) {
    super(message);
    this.name = "PaymentInputError";
  }
}

export async function registerPayment(partyId: string, input: unknown) {
  const parsed = paymentInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new PaymentInputError(parsed.error.issues[0]?.message ?? "Проверьте данные выплаты.");
  }

  const payment = await registerPartyPayment(partyId, toRecordInput(parsed.data));

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

export async function correctPayment(partyId: string, paymentId: string, input?: PaymentInput) {
  return correctPartyPayment(partyId, paymentId, input && toRecordInput(input));
}
