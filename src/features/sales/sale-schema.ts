import { z } from "zod";
import { parseAdenaInput } from "@/lib/adena";

export const saleInputSchema = z.object({
  lootDropId: z.string().min(1, "Выберите запись о выпадении."),
  quantitySold: z
    .number()
    .int()
    .min(1, "Количество должно быть положительным целым числом.")
    .max(2_147_483_647, "Количество слишком велико."),
  totalPrice: z
    .string()
    .trim()
    .transform(parseAdenaInput)
    .refine((value): value is string => value !== null, "Введите сумму Adena, например 5.25м."),
  receivedAt: z.string().datetime({ offset: true }),
  comment: z
    .string()
    .trim()
    .max(500, "Комментарий должен содержать не более 500 символов.")
    .optional(),
  idempotencyKey: z.string().uuid(),
});

export type SaleInput = z.infer<typeof saleInputSchema>;
