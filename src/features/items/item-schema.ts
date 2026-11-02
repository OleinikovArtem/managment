import { z } from "zod";

export function normalizeItemName(name: string): string {
  return name
    .normalize("NFC")
    .trim()
    .replace(/\s+/gu, " ")
    .toLowerCase()
    .normalize("NFC");
}

const itemNameSchema = z
  .string()
  .min(1, "Введите название предмета.")
  .max(200, "Название предмета должно содержать не более 200 символов.")
  .refine((name) => normalizeItemName(name).length > 0, {
    message: "Название не может состоять только из пробелов.",
  });

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} должно содержать не более ${max} символов.`)
    .optional();

export const itemInputSchema = z
  .object({
    canonicalName: itemNameSchema,
    displayName: optionalText(200, "Отображаемое название"),
    category: optionalText(80, "Категория"),
    grade: optionalText(40, "Ранг"),
    itemType: optionalText(80, "Тип предмета"),
    itemSubtype: optionalText(80, "Вариант предмета"),
    isRare: z.boolean().optional(),
    gameVersion: optionalText(80, "Версия игры"),
    comment: optionalText(500, "Комментарий"),
  })
  .strict();

export const itemIdSchema = z.string().trim().min(1, "Некорректный идентификатор предмета.");

export const itemSearchSchema = z.object({
  query: z.string().max(200).optional(),
  category: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).optional(),
});

export type ItemInput = z.infer<typeof itemInputSchema>;
