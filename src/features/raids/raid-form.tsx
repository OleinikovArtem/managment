"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createItemAction } from "@/app/(dashboard)/items/actions";
import {
  createRaidAction,
  updateRaidAction,
} from "@/app/(dashboard)/raids/actions";
import type { RaidActionResult } from "@/features/raids/raid-action-result";
import {
  localDateTimeToUtc,
  toLocalDateTimeInput,
} from "@/features/raids/local-date-time";
import {
  raidFormSchema,
  type RaidFormValues,
} from "@/features/raids/raid-schema";

export type RaidMemberOption = {
  id: string;
  nickname: string;
  status: "PRESENT" | "ABSENT";
};

export type RaidItemOption = {
  id: string;
  canonicalName: string;
  displayName: string | null;
};

type RaidInitialValues = Omit<RaidFormValues, "occurredAt"> & {
  occurredAt: string;
};

type RaidFormProps = {
  members: RaidMemberOption[];
  items: RaidItemOption[];
  initialValues?: RaidInitialValues;
  raidId?: string;
  submitLabel: string;
};

export function RaidForm({
  members,
  items,
  initialValues,
  raidId,
  submitLabel,
}: RaidFormProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [quickItemName, setQuickItemName] = useState("");
  const [quickItemMessage, setQuickItemMessage] = useState<string | null>(null);
  const [availableItems, setAvailableItems] = useState(items);
  const [isPending, startTransition] = useTransition();
  const [isCatalogPending, startCatalogTransition] = useTransition();
  const form = useForm<RaidFormValues>({
    resolver: zodResolver(raidFormSchema),
    defaultValues: initialValues
      ? {
          ...initialValues,
          occurredAt: toLocalDateTimeInput(initialValues.occurredAt),
        }
      : {
          name: "",
          instanceName: "",
          occurredAt: toLocalDateTimeInput(new Date()),
          comment: "",
          participants: members.map(({ id, status }) => ({
            memberId: id,
            status,
          })),
          lootDrops: [],
        },
  });
  const participants = useFieldArray({ control: form.control, name: "participants" });
  const lootDrops = useFieldArray({ control: form.control, name: "lootDrops" });
  const participantValues = useWatch({ control: form.control, name: "participants" }) ?? [];

  const onSubmit = form.handleSubmit((values) => {
    setMessage(null);
    const occurredAt = localDateTimeToUtc(values.occurredAt);
    if (!occurredAt) {
      setMessage("Это локальное время недопустимо или неоднозначно из-за перевода часов.");
      return;
    }

    startTransition(async () => {
      const payload = { ...values, occurredAt };
      const result: RaidActionResult = raidId
        ? await updateRaidAction(raidId, payload)
        : await createRaidAction(payload);
      if (!result.ok) {
        setMessage(result.message);
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      router.push(`/raids/${result.raidId}`);
      router.refresh();
    });
  });

  function addCatalogItem() {
    const canonicalName = quickItemName.trim();
    if (!canonicalName) {
      setQuickItemMessage("Введите оригинальное название предмета.");
      return;
    }

    setQuickItemMessage(null);
    startCatalogTransition(async () => {
      const result = await createItemAction({ canonicalName });
      if (!result.ok) {
        setQuickItemMessage(result.message);
        toast.error(result.message);
        return;
      }

      const itemId = result.itemId;
      if (!itemId) {
        throw new Error("Созданный предмет не вернул идентификатор.");
      }
      setAvailableItems((current) => [
        ...current,
        { id: itemId, canonicalName, displayName: null },
      ]);
      setQuickItemName("");
      toast.success(result.message);
    });
  }

  return (
    <form className="space-y-6" onSubmit={onSubmit} noValidate>
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="raid-name" className="text-sm font-medium">
            Название рейда <span className="text-destructive">*</span>
          </label>
          <Input
            id="raid-name"
            maxLength={120}
            aria-invalid={Boolean(form.formState.errors.name)}
            {...form.register("name")}
          />
          {form.formState.errors.name && (
            <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <label htmlFor="raid-instance" className="text-sm font-medium">
            Инстанс <span className="text-xs text-muted-foreground">(необязательно)</span>
          </label>
          <Input id="raid-instance" maxLength={120} {...form.register("instanceName")} />
        </div>
        <div className="space-y-2">
          <label htmlFor="raid-occurred-at" className="text-sm font-medium">
            Дата и локальное время <span className="text-destructive">*</span>
          </label>
          <Input
            id="raid-occurred-at"
            type="datetime-local"
            aria-invalid={Boolean(form.formState.errors.occurredAt)}
            {...form.register("occurredAt")}
          />
          <p className="text-xs text-muted-foreground">
            При сохранении время переводится из часового пояса браузера в UTC.
          </p>
          {form.formState.errors.occurredAt && (
            <p className="text-xs text-destructive">
              {form.formState.errors.occurredAt.message}
            </p>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-medium">Состав группы на момент рейда</h2>
          <p className="text-sm text-muted-foreground">
            Снимок включает всех текущих участников; отметьте тех, кто отсутствовал.
            После сохранения участники снимка не добавляются и не удаляются.
          </p>
        </div>
        {members.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Для создания рейда сначала добавьте участника в разделе «Участники».
          </div>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {members.map((member, index) => {
              const isPresent = participantValues[index]?.status === "PRESENT";
              return (
                <li key={participants.fields[index]?.id ?? member.id}>
                  <label className="flex min-h-11 items-center gap-3 rounded-lg border px-3">
                    <input
                      type="checkbox"
                      checked={isPresent}
                      disabled={isPending}
                      onChange={(event) =>
                        form.setValue(
                          `participants.${index}.status`,
                          event.target.checked ? "PRESENT" : "ABSENT",
                          { shouldDirty: true, shouldValidate: true },
                        )
                      }
                    />
                    <span className="flex-1">{member.nickname}</span>
                    <Badge variant={isPresent ? "secondary" : "outline"}>
                      {isPresent ? "Был" : "Отсутствовал"}
                    </Badge>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            aria-label="Новое название предмета"
            maxLength={200}
            value={quickItemName}
            onChange={(event) => setQuickItemName(event.target.value)}
            placeholder="Новый предмет в каталог"
            disabled={isPending || isCatalogPending}
          />
          <Button
            type="button"
            variant="outline"
            onClick={addCatalogItem}
            disabled={isPending || isCatalogPending}
          >
            <Plus aria-hidden="true" />
            {isCatalogPending ? "Добавление..." : "Добавить в каталог"}
          </Button>
        </div>
        {quickItemMessage && (
          <p role="alert" className="text-sm text-destructive">{quickItemMessage}</p>
        )}
        {(form.formState.errors.participants?.message ??
          form.formState.errors.participants?.root?.message) && (
          <p className="text-xs text-destructive">
            {form.formState.errors.participants.message ??
              form.formState.errors.participants.root?.message}
          </p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-medium">Выпадения предметов</h2>
            <p className="text-sm text-muted-foreground">
              Каждое получение сохраняется отдельной записью, даже если Item повторяется.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              lootDrops.append({
                itemId: availableItems[0]?.id ?? "",
                quantity: 1,
                comment: "",
              })
            }
            disabled={availableItems.length === 0 || isPending}
          >
            <Plus aria-hidden="true" />
            Добавить выпадение
          </Button>
        </div>
        {availableItems.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Каталог пока пуст. Добавьте первый предмет прямо здесь или откройте раздел «Предметы».
          </div>
        ) : lootDrops.fields.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            У этого рейда пока нет записей о выпадениях.
          </div>
        ) : (
          <ul className="space-y-3">
            {lootDrops.fields.map((field, index) => (
              <li key={field.id} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
                <div className="space-y-2">
                  <label htmlFor={`loot-item-${index}`} className="text-sm font-medium">
                    Предмет
                  </label>
                  <select
                    id={`loot-item-${index}`}
                    className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm"
                    {...form.register(`lootDrops.${index}.itemId`)}
                  >
                    {availableItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.displayName || item.canonicalName}
                      </option>
                    ))}
                  </select>
                  <Input
                    aria-label={`Комментарий к выпадению ${index + 1}`}
                    maxLength={500}
                    placeholder="Комментарий к выпадению (необязательно)"
                    {...form.register(`lootDrops.${index}.comment`)}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor={`loot-quantity-${index}`} className="text-sm font-medium">
                    Количество
                  </label>
                  <Input
                    id={`loot-quantity-${index}`}
                    type="number"
                    min={1}
                    max={1_000_000}
                    step={1}
                    {...form.register(`lootDrops.${index}.quantity`, { valueAsNumber: true })}
                  />
                  {form.formState.errors.lootDrops?.[index]?.quantity && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.lootDrops[index]?.quantity?.message}
                    </p>
                  )}
                  {form.getValues(`lootDrops.${index}.id`) && (
                    <p className="text-xs text-muted-foreground">Историческая запись</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="space-y-2">
        <label htmlFor="raid-comment" className="text-sm font-medium">
          Комментарий <span className="text-xs text-muted-foreground">(необязательно)</span>
        </label>
        <Textarea id="raid-comment" rows={3} maxLength={1000} {...form.register("comment")} />
      </div>

      {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isPending || members.length === 0}>
          {initialValues ? <Save aria-hidden="true" /> : <Plus aria-hidden="true" />}
          {isPending ? "Сохранение..." : submitLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={isPending}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
