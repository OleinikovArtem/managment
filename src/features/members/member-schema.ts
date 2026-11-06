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
  className: z.string().trim().max(80, "Класс не должен превышать 80 символов.").optional(),
  level: z.number().int().min(1).max(99).optional().nullable(),
  role: z.string().trim().max(40, "Роль не должна превышать 40 символов.").optional(),
  subclasses: z.array(z.object({
    id: z.string().min(1).optional(),
    slot: z.number().int().min(1).max(4),
    className: z.string().trim().max(80),
  })).max(4, "Можно указать не больше четырёх Subclass.").optional(),
}).superRefine((input, ctx) => {
  const slots = new Set<number>(), ids = new Set<string>();
  for (const entry of input.subclasses ?? []) {
    if (slots.has(entry.slot) || (entry.id && ids.has(entry.id))) {
      ctx.addIssue({ code: "custom", path: ["subclasses"], message: "Каждый слот и профиль Subclass можно выбрать только один раз." });
    }
    slots.add(entry.slot);
    if (entry.id) ids.add(entry.id);
  }
});

export const memberIdSchema = z.string().trim().min(1, "Member ID is required.");

export type MemberInput = z.infer<typeof memberInputSchema>;
export type MemberFormInput = z.input<typeof memberInputSchema>;
