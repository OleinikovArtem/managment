"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Plus, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ItemActionResult } from "@/features/items/item-action-result";
import {
  itemInputSchema,
  type ItemInput,
} from "@/features/items/item-schema";

type ItemFormProps = {
  initialValues?: ItemInput;
  submitLabel: string;
  action: (values: ItemInput) => Promise<ItemActionResult>;
  onSuccess: (itemId?: string) => void;
  onCancel?: () => void;
};

const fields = [
  { name: "grade", label: "Ранг", maxLength: 40, placeholder: "S80, S84, A..." },
  { name: "itemType", label: "Тип предмета", maxLength: 80, placeholder: "Boots, Sword, Bow..." },
  { name: "itemSubtype", label: "Вариант", maxLength: 80, placeholder: "Light, Heavy, Robe..." },
  { name: "displayName", label: "Отображаемое название", maxLength: 200, placeholder: "" },
  { name: "gameVersion", label: "Версия игры", maxLength: 80, placeholder: "" },
] as const;

const itemCategories = [
  "Weapon",
  "Armor",
  "Jewelry",
  "Materials",
  "Skill Book",
  "Enchant Scroll",
  "Other",
];

export function ItemForm({
  initialValues,
  submitLabel,
  action,
  onSuccess,
  onCancel,
}: ItemFormProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const form = useForm<ItemInput>({
    resolver: zodResolver(itemInputSchema),
    defaultValues: initialValues ?? {
      canonicalName: "",
      displayName: "",
      category: "",
      grade: "",
      itemType: "",
      itemSubtype: "",
      isRare: false,
      gameVersion: "",
      comment: "",
    },
  });
  const availableCategories =
    initialValues?.category &&
    !itemCategories.includes(initialValues.category)
      ? [initialValues.category, ...itemCategories]
      : itemCategories;

  const onSubmit = form.handleSubmit((values) => {
    setMessage(null);
    startTransition(async () => {
      const result = await action(values);
      if (!result.ok) {
        setMessage(result.message);
        for (const field of [
          "canonicalName",
          "displayName",
          "category",
          "grade",
          "itemType",
          "itemSubtype",
          "gameVersion",
          "comment",
        ] as const) {
          const fieldMessage = result.fieldErrors?.[field]?.[0];
          if (fieldMessage) {
            form.setError(field, { message: fieldMessage });
          }
        }
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      onSuccess(result.itemId);
    });
  });

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      <div className="space-y-2">
        <label htmlFor="canonical-name" className="text-sm font-medium">
          Оригинальное название <span className="text-destructive">*</span>
        </label>
        <Input
          id="canonical-name"
          autoComplete="off"
          maxLength={200}
          aria-invalid={Boolean(form.formState.errors.canonicalName)}
          {...form.register("canonicalName")}
          placeholder="Название предмета в игре"
        />
        {form.formState.errors.canonicalName && (
          <p className="text-xs text-destructive">
            {form.formState.errors.canonicalName.message}
          </p>
        )}
      </div>

      <details className="disclosure">
        <summary className="text-sm font-medium">Классификация и заметка</summary>
        <div className="space-y-4 pt-4">
      <div className="space-y-2">
        <label htmlFor="category" className="text-sm font-medium">
          Группа предмета{" "}
          <span className="text-xs text-muted-foreground">(необязательно)</span>
        </label>
        <select
          id="category"
          aria-invalid={Boolean(form.formState.errors.category)}
          className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground"
          {...form.register("category")}
        >
          <option value="">Не выбрана</option>
          {availableCategories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        {form.formState.errors.category && (
          <p className="text-xs text-destructive">
            {form.formState.errors.category.message}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map(({ name, label, maxLength, placeholder }) => (
          <div key={name} className="space-y-2">
            <label htmlFor={name} className="text-sm font-medium">
              {label} <span className="text-xs text-muted-foreground">(необязательно)</span>
            </label>
            <Input
              id={name}
              maxLength={maxLength}
              placeholder={placeholder}
              aria-invalid={Boolean(form.formState.errors[name])}
              {...form.register(name)}
            />
            {form.formState.errors[name] && (
              <p className="text-xs text-destructive">
                {form.formState.errors[name]?.message}
              </p>
            )}
          </div>
        ))}
      </div>

      <label className="flex items-center gap-3 text-sm font-medium">
        <Input
          type="checkbox"
          className="size-4 min-w-4 accent-primary"
          {...form.register("isRare")}
        />
        Rare (редкий вариант)
      </label>

      <div className="space-y-2">
        <label htmlFor="item-comment" className="text-sm font-medium">
          Комментарий <span className="text-xs text-muted-foreground">(необязательно)</span>
        </label>
        <Textarea
          id="item-comment"
          rows={3}
          maxLength={500}
          aria-invalid={Boolean(form.formState.errors.comment)}
          {...form.register("comment")}
          placeholder="Заметка о предмете"
        />
        {form.formState.errors.comment && (
          <p className="text-xs text-destructive">
            {form.formState.errors.comment.message}
          </p>
        )}
      </div>

        </div>
      </details>
      {message && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isPending}>
          {initialValues ? <Save aria-hidden="true" /> : <Plus aria-hidden="true" />}
          {isPending ? "Сохранение..." : submitLabel}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isPending}
          >
            <X aria-hidden="true" />
            Отмена
          </Button>
        )}
      </div>
    </form>
  );
}
