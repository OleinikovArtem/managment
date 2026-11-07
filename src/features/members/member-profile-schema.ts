import { z } from "zod";

export const memberProfileInputSchema = z
  .object({
    memberId: z.string().trim().min(1),
    name: z.string().trim().min(1, "Введите название профиля.").max(80),
    className: z.string().trim().min(1, "Укажите класс.").max(80),
    role: z.string().trim().max(40).optional(),
    level: z.number().int().min(1).max(99).nullable().optional(),
    note: z.string().trim().max(240).optional(),
  })
  .strict();

export const memberProfileIdSchema = z.string().trim().min(1);
export const memberProfileUpdateSchema = memberProfileInputSchema
  .omit({ memberId: true })
  .extend({ expectedUpdatedAt: z.iso.datetime() });
export type MemberProfileInput = z.infer<typeof memberProfileInputSchema>;
export type MemberProfileUpdateInput = z.infer<typeof memberProfileUpdateSchema>;
