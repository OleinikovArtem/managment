import type { SaleInput } from "@/features/sales/sale-schema";

type SaleField = keyof SaleInput;

export type SaleActionResult =
  | {
      ok: true;
      message: string;
      sale: {
        id: string;
        receivedAt: string;
        totalPrice: string;
        quantitySold: number;
        shares: {
          memberId: string;
          nicknameSnapshot: string;
          amount: string;
          weightSnapshot: number;
        }[];
      };
    }
  | {
      ok: false;
      message: string;
      fieldErrors?: Partial<Record<SaleField, string[]>>;
    };
