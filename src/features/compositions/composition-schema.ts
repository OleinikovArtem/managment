import { z } from "zod";

export const compositionInputSchema = z.object({
  name: z.string().trim().min(1, "Введите название состава.").max(80),
  description: z.string().trim().max(240, "Описание слишком длинное.").optional(),
  focus: z.string().trim().max(40, "Тип состава слишком длинный.").optional(),
  slots: z.array(z.object({ memberId: z.string().trim().min(1), profileId: z.string().trim().min(1).optional() }).strict()).max(36, "В составе может быть не больше 36 участников."),
}).strict();

export const compositionIdSchema = z.string().trim().min(1, "Некорректный состав.");
export type CompositionInput = z.infer<typeof compositionInputSchema>;
