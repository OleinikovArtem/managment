import { z } from "zod";

const MAX_SQLITE_BIGINT = "9223372036854775807";

function isWithinSqliteBigIntRange(value: string) {
  return (
    value.length < MAX_SQLITE_BIGINT.length ||
    (value.length === MAX_SQLITE_BIGINT.length && value <= MAX_SQLITE_BIGINT)
  );
}

export const paymentInputSchema = z.object({
  memberId: z.string().min(1, "Выберите участника."),
  amount: z
    .string()
    .regex(/^[1-9]\d*$/, "Введите целую положительную сумму Adena без пробелов.")
    .refine(isWithinSqliteBigIntRange, "Сумма превышает допустимый предел SQLite."),
  paidAt: z.string().datetime({ offset: true }),
  comment: z
    .string()
    .trim()
    .max(500, "Комментарий должен содержать не более 500 символов.")
    .optional(),
  idempotencyKey: z.string().uuid(),
});

export type PaymentInput = z.infer<typeof paymentInputSchema>;
