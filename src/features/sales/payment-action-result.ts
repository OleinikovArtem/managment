import type { PaymentInput } from "@/features/sales/payment-schema";

type PaymentField = keyof PaymentInput;

export type PaymentActionResult =
  | {
      ok: true;
      message: string;
      payment: {
        id: string;
        memberId: string;
        nicknameSnapshot: string;
        amount: string;
        paidAt: string;
        allocations: { saleShareId: string; amount: string }[];
      };
    }
  | {
      ok: false;
      message: string;
      fieldErrors?: Partial<Record<PaymentField, string[]>>;
    };
