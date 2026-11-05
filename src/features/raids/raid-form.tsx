"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCheck, MoreHorizontal, Plus, Save, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Textarea } from "@/components/ui/textarea";
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
import { ItemCombobox } from "@/features/raids/item-combobox";
import { GameIcon } from "@/components/ui/game-icon";

export type RaidMemberOption = {
  id: string;
  nickname: string;
  status: "PRESENT" | "ABSENT";
  className?: string | null;
  role?: string | null;
  level?: number | null;
  profiles?: { id: string; name: string; className: string; role: string | null; level: number | null }[];
};

export type RaidCompositionOption = { id: string; name: string; focus: string | null; slots: { memberId: string; profileId: string | null }[] };

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
  compositions?: RaidCompositionOption[];
  initialValues?: RaidInitialValues;
  raidId?: string;
  submitLabel: string;
};

export function RaidForm({
  members,
  items,
  compositions = [],
  initialValues,
  raidId,
  submitLabel,
}: RaidFormProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [expandedLoot, setExpandedLoot] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();
  const form = useForm<RaidFormValues>({
    resolver: zodResolver(raidFormSchema),
    defaultValues: initialValues
      ? {
          ...initialValues,
          occurredAt: toLocalDateTimeInput(initialValues.occurredAt),
        }
      : {
          name: "",
          compositionId: "",
          instanceName: "",
          occurredAt: toLocalDateTimeInput(new Date()),
          comment: "",
          participants: members.map(({ id, status }) => ({
            memberId: id,
            status,
            profileId: undefined,
          })),
          lootDrops: [],
        },
  });
  const participants = useFieldArray({ control: form.control, name: "participants" });
  const lootDrops = useFieldArray({ control: form.control, name: "lootDrops" });
  const participantValues = useWatch({ control: form.control, name: "participants" }) ?? [];
  const lootDropValues = useWatch({ control: form.control, name: "lootDrops" }) ?? [];
  const occurredAt = useWatch({ control: form.control, name: "occurredAt" });
  const compositionId = useWatch({ control: form.control, name: "compositionId" });
  const presentCount = participantValues.filter(({ status }) => status === "PRESENT").length;
  const allPresent = members.length > 0 && presentCount === members.length;

  function applyComposition(compositionId: string) {
    const composition = compositions.find((item) => item.id === compositionId);
    form.setValue("compositionId", compositionId || undefined, { shouldDirty: true });
    if (!composition) return;
    members.forEach((member, index) => {
      const slot = composition.slots.find((item) => item.memberId === member.id);
      form.setValue(`participants.${index}.status`, slot ? "PRESENT" : "ABSENT", { shouldDirty: true, shouldValidate: true });
      form.setValue(`participants.${index}.profileId`, slot?.profileId ?? undefined, { shouldDirty: true, shouldValidate: true });
    });
  }

  function setAllParticipantStatuses(status: "PRESENT" | "ABSENT") {
    members.forEach((_, index) => {
      form.setValue(`participants.${index}.status`, status, {
        shouldDirty: true,
        shouldValidate: true,
      });
    });
  }

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
        {compositions.length > 0 && <div className="space-y-2 sm:col-span-2"><label htmlFor="raid-composition" className="text-sm font-medium">Профиль состава <span className="text-xs font-normal text-muted-foreground">(необязательно)</span></label><select id="raid-composition" value={compositionId ?? ""} onChange={(event) => applyComposition(event.target.value)} disabled={isPending} className="h-9 w-full rounded-lg border border-input bg-background/35 px-3 text-sm"><option value="">Без профиля — выбрать вручную</option>{compositions.map((composition) => <option key={composition.id} value={composition.id}>{composition.name}{composition.focus ? ` · ${composition.focus}` : ""}</option>)}</select><p className="text-xs text-muted-foreground">Профиль отметит участников присутствующими и оставит остальные места в снимке рейда.</p></div>}
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
          <DateInput id="raid-occurred-at" value={occurredAt} withTime aria-invalid={Boolean(form.formState.errors.occurredAt)} onChange={(value) => form.setValue("occurredAt", value, { shouldDirty: true, shouldValidate: true })} />
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-medium">Состав группы на момент рейда</h2>
            <p className="text-sm text-muted-foreground">
              Отметьте присутствующих. Снимок сохраняет всех участников, а статус можно изменить до сохранения.
            </p>
          </div>
          {members.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAllParticipantStatuses(allPresent ? "ABSENT" : "PRESENT")}
              disabled={isPending}
              aria-label={allPresent ? "Снять отметку со всех участников" : "Отметить всех участников присутствующими"}
            >
              <CheckCheck aria-hidden="true" />
              {allPresent ? "Снять всех" : "Отметить всех"}
            </Button>
          )}
        </div>
        {members.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Для создания рейда сначала добавьте участника в разделе «Участники».
          </div>
        ) : (
          <>
            <p className="text-xs font-medium text-muted-foreground" aria-live="polite">
              Присутствуют: <span className="text-foreground">{presentCount} из {members.length}</span>
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
            {members.map((member, index) => {
              const isPresent = participantValues[index]?.status === "PRESENT";
              return (
                <li key={participants.fields[index]?.id ?? member.id}>
                  <label className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-3 transition-colors ${isPresent ? "border-primary/40 bg-primary/5" : "hover:bg-muted/40"}`}>
                    <input
                      type="checkbox"
                      aria-label={`${isPresent ? "Убрать присутствие" : "Отметить присутствие"}: ${member.nickname}`}
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
                    <span className="min-w-0 flex-1"><span className="block truncate">{member.nickname}</span>{(member.className || member.role || member.level) && <span className="block truncate text-[11px] text-muted-foreground">{[member.className, member.role, member.level ? `Lv. ${member.level}` : null].filter(Boolean).join(" · ")}</span>}</span>
                    {isPresent && (member.profiles?.length ?? 0) > 0 && <select aria-label={`Профиль ${member.nickname}`} className="h-8 max-w-44 rounded-md border border-input bg-background px-2 text-xs" value={participantValues[index]?.profileId ?? ""} disabled={isPending} onChange={(event) => form.setValue(`participants.${index}.profileId`, event.target.value || undefined, { shouldDirty: true, shouldValidate: true })}><option value="">Базовый профиль</option>{member.profiles?.map((profile) => <option key={profile.id} value={profile.id}>{profile.name} · {profile.className}</option>)}</select>}
                    <Badge variant={isPresent ? "secondary" : "outline"}>
                      {isPresent ? "Был" : "Отсутствовал"}
                    </Badge>
                  </label>
                </li>
              );
            })}
            </ul>
          </>
        )}
        {(form.formState.errors.participants?.message ??
          form.formState.errors.participants?.root?.message) && (
          <p className="text-xs text-destructive">
            {form.formState.errors.participants.message ??
              form.formState.errors.participants.root?.message}
          </p>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-border/70 bg-card/40 p-4 sm:p-5">
        <div>
          <div className="flex items-center gap-2"><h2 className="font-medium">Лут</h2><span className="text-xs text-muted-foreground">{lootDrops.fields.length} предметов</span></div>
          <p className="text-sm text-muted-foreground">Выберите предмет — он сразу появится в компактной строке.</p>
        </div>
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Каталог пока пуст. Сначала добавьте предмет в разделе «Предметы».</div>
        ) : (
          <>
            <ItemCombobox id="loot-add-item" items={items} value="" onChange={(itemId) => lootDrops.append({ itemId, quantity: 1, comment: "" })} disabled={isPending} />
            {lootDrops.fields.length === 0 ? <p className="py-3 text-xs text-muted-foreground">Пока ничего не добавлено.</p> : <ul className="divide-y divide-border/70">
              {lootDrops.fields.map((field, index) => {
                const item = items.find((option) => option.id === lootDropValues[index]?.itemId);
                const historical = Boolean(form.getValues(`lootDrops.${index}.id`));
                return <li key={field.id} className="py-2.5 first:pt-3 last:pb-0">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="min-w-0 flex-1">{item ? <div className="flex items-center gap-2"><GameIcon kind="item" name={item.displayName || item.canonicalName} size="sm" /><p className="truncate text-sm font-medium">{item.displayName || item.canonicalName}</p></div> : <p className="truncate text-sm font-medium">Предмет не выбран</p>}{historical && <p className="text-[11px] text-muted-foreground">Историческая запись</p>}</div>
                    <Input aria-label={`Количество для выпадения ${index + 1}`} id={`loot-quantity-${index}`} type="number" min={1} max={1_000_000} step={1} className="w-20 text-right tabular-nums" {...form.register(`lootDrops.${index}.quantity`, { valueAsNumber: true })} />
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Дополнительные поля выпадения ${index + 1}`} aria-expanded={Boolean(expandedLoot[field.id])} onClick={() => setExpandedLoot((state) => ({ ...state, [field.id]: !state[field.id] }))} disabled={isPending}><MoreHorizontal aria-hidden="true" /></Button>
                    {!historical && <Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" aria-label={`Удалить выпадение ${index + 1}`} onClick={() => lootDrops.remove(index)} disabled={isPending}><Trash2 aria-hidden="true" /></Button>}
                  </div>
                  {form.formState.errors.lootDrops?.[index]?.quantity && <p className="mt-1 text-right text-xs text-destructive">{form.formState.errors.lootDrops[index]?.quantity?.message}</p>}
                  {expandedLoot[field.id] && <div className="mt-2 sm:pr-20"><label htmlFor={`loot-comment-${index}`} className="sr-only">Комментарий к выпадению</label><Input id={`loot-comment-${index}`} maxLength={500} placeholder="Комментарий к выпадению (необязательно)" {...form.register(`lootDrops.${index}.comment`)} /></div>}
                </li>;
              })}
            </ul>}
          </>
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
