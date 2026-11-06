import { z } from "zod";
import { RESET_PARTY_CONFIRMATION } from "./reset-confirmation";

export const resetCategorySchema = z.enum(["payments", "sales", "loot", "raids", "compositions", "members"]);
export type ResetCategory = z.infer<typeof resetCategorySchema>;
export const resetSelectionSchema = z.array(resetCategorySchema).min(1, "Выберите данные для сброса.").max(6);
export const resetRequestSchema = z.object({
  confirmation: z.literal(RESET_PARTY_CONFIRMATION, { error: `Введите точно: ${RESET_PARTY_CONFIRMATION}.` }),
  categories: resetSelectionSchema,
});
export const RESET_OPTIONS: ReadonlyArray<{ id: ResetCategory; label: string; description: string; dependencies: readonly ResetCategory[] }> = [
  { id: "raids", label: "Рейды", description: "Рейды и снимки их участников; также удалятся лут и финансы.", dependencies: ["loot"] },
  { id: "loot", label: "Лут рейдов", description: "Поступления предметов; также удалятся продажи и выплаты. Общий каталог останется.", dependencies: ["sales"] },
  { id: "sales", label: "Продажи", description: "Продажи, начисленные доли и проводки; также удалятся выплаты.", dependencies: ["payments"] },
  { id: "payments", label: "Выплаты участникам", description: "Передачи Adena, покрытия долей и проводки выплат.", dependencies: [] },
  { id: "compositions", label: "Сохранённые составы", description: "Шаблоны, их слоты и ссылки рейдов на эти шаблоны.", dependencies: [] },
  { id: "members", label: "Участники и профили", description: "Игровые персонажи и профили; также удалятся составы, рейды, лут и финансы.", dependencies: ["raids", "compositions"] },
];

export function resolveResetCategories(selection: readonly ResetCategory[]): ResetCategory[] {
  const selected = new Set<ResetCategory>();
  function include(id: ResetCategory) {
    if (selected.has(id)) return;
    selected.add(id);
    for (const dependency of RESET_OPTIONS.find(option => option.id === id)!.dependencies) include(dependency);
  }
  for (const id of resetSelectionSchema.parse(selection)) include(id);
  return RESET_OPTIONS.filter(option => selected.has(option.id)).map(option => option.id);
}
