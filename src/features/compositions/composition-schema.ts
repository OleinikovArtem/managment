import { z } from "zod";
import { LINEAGE2_HIGH_FIVE_CLASSES } from "@/features/members/lineage2-classes";

export const compositionInputSchema = z
  .object({
    name: z.string().trim().min(1, "Введите название состава.").max(80),
    description: z.string().trim().max(240, "Описание слишком длинное.").optional(),
    focus: z.string().trim().max(40, "Тип состава слишком длинный.").optional(),
    slots: z
      .array(
        z
          .object({
            memberId: z.string().trim().min(1),
            profileId: z.string().trim().min(1).optional(),
            classOverride: z.enum(LINEAGE2_HIGH_FIVE_CLASSES).optional(),
          })
          .strict()
          .refine((slot) => !(slot.profileId && slot.classOverride), {
            message: "Выберите сохранённый профиль или профессию из каталога, не оба варианта.",
          }),
      )
      .max(36, "В составе может быть не больше 36 участников."),
  })
  .strict();

export const compositionIdSchema = z.string().trim().min(1, "Некорректный состав.");
export type CompositionInput = z.infer<typeof compositionInputSchema>;
