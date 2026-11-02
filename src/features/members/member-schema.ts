import { z } from "zod";

export function normalizeNickname(nickname: string): string {
  return nickname
    .normalize("NFC")
    .trim()
    .replace(/\s+/gu, " ")
    .toLowerCase();
}

const nicknameSchema = z
  .string()
  .min(1, "Введите игровой ник.")
  .max(64, "Ник должен содержать не более 64 символов.")
  .refine((nickname) => normalizeNickname(nickname).length > 0, {
    message: "Ник не может состоять только из пробелов.",
  });

export const memberInputSchema = z.object({
  nickname: nicknameSchema,
  distributionWeight: z
    .number()
    .int()
    .min(1, "Вес должен быть положительным целым числом.")
    .max(2_147_483_647, "Вес слишком велик.")
    .default(1),
  comment: z
    .string()
    .trim()
    .max(500, "Комментарий должен содержать не более 500 символов.")
    .optional(),
});

export const memberIdSchema = z.string().trim().min(1, "Member ID is required.");

export type MemberInput = z.infer<typeof memberInputSchema>;
export type MemberFormInput = z.input<typeof memberInputSchema>;
