import type { ItemInput } from "@/features/items/item-schema";

type ItemField = keyof ItemInput;

export type ItemActionResult =
  | { ok: true; message: string; itemId?: string }
  | {
      ok: false;
      message: string;
      fieldErrors?: Partial<Record<ItemField, string[]>>;
    };
