import { z } from "zod";
import { parseAdenaInput } from "@/lib/adena";

export const paymentInputSchema = z.object({
  memberId: z.string().min(1, "Выберите участника."),
  amount: z
    .string()
    .trim()
    .transform(parseAdenaInput)
    .refine((value): value is string => value !== null, "Введите сумму Adena, например 5.25м."),
  paidAt: z.string().datetime({ offset: true }),
  comment: z
    .string()
    .trim()
    .max(500, "Комментарий должен содержать не более 500 символов.")
    .optional(),
  idempotencyKey: z.string().uuid(),
});

export type PaymentInput = z.infer<typeof paymentInputSchema>;
