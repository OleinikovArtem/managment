import { z } from "zod";

const MAX_SQLITE_BIGINT = "9223372036854775807";

function isWithinSqliteBigIntRange(value: string) {
  return (
    value.length < MAX_SQLITE_BIGINT.length ||
    (value.length === MAX_SQLITE_BIGINT.length && value <= MAX_SQLITE_BIGINT)
  );
}

export const saleInputSchema = z.object({
  lootDropId: z.string().min(1, "Выберите запись о выпадении."),
  quantitySold: z.number().int().min(1, "Количество должно быть положительным целым числом.").max(
    2_147_483_647,
    "Количество слишком велико.",
  ),
  totalPrice: z
    .string()
    .regex(/^[1-9]\d*$/, "Введите целую положительную сумму Adena без пробелов.")
    .refine(isWithinSqliteBigIntRange, "Сумма превышает допустимый предел SQLite."),
  receivedAt: z.string().datetime({ offset: true }),
  comment: z.string().trim().max(500, "Комментарий должен содержать не более 500 символов.").optional(),
  idempotencyKey: z.string().uuid(),
});

export type SaleInput = z.infer<typeof saleInputSchema>;
