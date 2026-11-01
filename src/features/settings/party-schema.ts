import { z } from "zod";

export const partySettingsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Введите название группы.")
    .max(80, "Название группы должно содержать не более 80 символов."),
});

export type PartySettingsInput = z.infer<typeof partySettingsSchema>;
