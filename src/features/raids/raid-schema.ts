import { z } from "zod";

const text = (max: number, label: string) =>
  z.string().trim().max(max, `${label} не должен превышать ${max} символов.`).optional();

const participantSchema = z.object({
  memberId: z.string().trim().min(1, "Некорректный участник."),
  status: z.enum(["PRESENT", "ABSENT"]),
  profileId: z.string().trim().min(1).optional(),
}).strict();

const lootDropSchema = z.object({
  id: z.string().trim().min(1).optional(),
  itemId: z.string().trim().min(1, "Выберите предмет."),
  quantity: z.number().int("Количество должно быть целым числом.")
    .positive("Количество должно быть больше нуля.")
    .max(1_000_000, "Количество слишком велико."),
  comment: text(500, "Комментарий"),
}).strict();

const raidFields = {
  compositionId: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1, "Введите название рейда.").max(120),
  instanceName: text(120, "Название инстанса"),
  comment: text(1000, "Комментарий"),
  participants: z.array(participantSchema).min(1, "Добавьте участников рейда."),
  lootDrops: z.array(lootDropSchema),
};

function validateCollections(
  input: { participants: { memberId: string; status: string }[]; lootDrops: { id?: string }[] },
  context: z.RefinementCtx,
) {
  const memberIds = input.participants.map(({ memberId }) => memberId);
  if (new Set(memberIds).size !== memberIds.length) {
    context.addIssue({
      code: "custom",
      path: ["participants"],
      message: "Участник не может быть добавлен в рейд дважды.",
    });
  }

  if (!input.participants.some(({ status }) => status === "PRESENT")) {
    context.addIssue({
      code: "custom",
      path: ["participants"],
      message: "В рейде должен присутствовать хотя бы один участник.",
    });
  }

  const lootDropIds = input.lootDrops.flatMap(({ id }) => id ? [id] : []);
  if (new Set(lootDropIds).size !== lootDropIds.length) {
    context.addIssue({
      code: "custom",
      path: ["lootDrops"],
      message: "Одна запись о выпадении не может быть указана дважды.",
    });
  }
}

export const raidInputSchema = z.object({
  ...raidFields,
  occurredAt: z.string().datetime({ message: "Укажите дату и время рейда." }),
}).strict().superRefine(validateCollections);

export const raidFormSchema = z.object({
  ...raidFields,
  occurredAt: z.string().min(1, "Укажите дату и время рейда."),
}).strict().superRefine(validateCollections);

export const raidIdSchema = z.string().trim().min(1, "Некорректный идентификатор рейда.");

export type RaidInput = z.infer<typeof raidInputSchema>;
export type RaidFormValues = z.infer<typeof raidFormSchema>;
