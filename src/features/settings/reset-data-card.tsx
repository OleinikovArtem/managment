"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EditorDialog } from "@/components/ui/editor-dialog";
import { Input } from "@/components/ui/input";
import { resetPartyDataAction } from "@/app/(dashboard)/settings/actions";
import { RESET_PARTY_CONFIRMATION } from "@/features/settings/reset-confirmation";
import { RESET_OPTIONS, resolveResetCategories, type ResetCategory } from "./reset-plan";

export function ResetDataCard() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [requested, setRequested] = useState<ResetCategory[]>([]);
  const [value, setValue] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const selected = requested.length ? resolveResetCategories(requested) : [];
  function select(next: ResetCategory[]) {
    setRequested(next);
    setValue("");
    setMessage(null);
  }
  function resetData() {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await resetPartyDataAction({ confirmation: value, categories: requested });
        setMessage({ ok: result.ok, text: result.message });
        if (result.ok) {
          setValue("");
          setRequested([]);
          setOpen(false);
          toast.success(result.message);
          router.refresh();
        } else toast.error(result.message);
      } catch {
        setMessage({
          ok: false,
          text: "Не удалось выполнить запрос. Обновите страницу и проверьте данные перед повтором.",
        });
      }
    });
  }
  return (
    <section className="border-t border-border pt-5" aria-labelledby="danger-zone-title">
      <h2 id="danger-zone-title" className="text-base font-semibold text-destructive">
        Опасная зона
      </h2>
      <p className="mt-2 mb-4 text-sm text-muted-foreground">
        Выберите данные группы для сброса. Связанные данные будут включены автоматически.
      </p>
      <Button
        variant="destructive"
        className="min-h-11"
        onClick={() => {
          select([]);
          setOpen(true);
        }}
      >
        <Trash2 aria-hidden="true" size={16} />
        Сбросить данные
      </Button>
      {!open && message && (
        <p role={message.ok ? "status" : "alert"} className="mt-3 text-sm text-muted-foreground">
          {message.text}
        </p>
      )}
      <EditorDialog
        open={open}
        onClose={() => {
          if (!isPending) {
            setOpen(false);
            setValue("");
          }
        }}
        title="Сбросить данные группы"
        description="Удаление необратимо. Отметьте нужные данные и проверьте зависимости перед подтверждением."
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (selected.length && value === RESET_PARTY_CONFIRMATION && !isPending) resetData();
          }}
          className="space-y-5"
          aria-busy={isPending}
        >
          <fieldset disabled={isPending} className="space-y-1">
            <legend className="mb-2 text-sm font-medium">Что удалить</legend>
            <div className="mb-2 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-11"
                onClick={() => select(RESET_OPTIONS.map((option) => option.id))}
              >
                Выбрать всё
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-11"
                onClick={() => select([])}
              >
                Снять выбор
              </Button>
            </div>
            {RESET_OPTIONS.map((option) => {
              const requiredBy = requested.filter(
                (id) => id !== option.id && resolveResetCategories([id]).includes(option.id),
              );
              return (
                <label
                  key={option.id}
                  className="flex min-h-11 cursor-pointer items-start gap-3 border-b border-border py-3"
                >
                  <input
                    type="checkbox"
                    className="mt-1 size-4 shrink-0 accent-destructive"
                    checked={selected.includes(option.id)}
                    disabled={isPending || requiredBy.length > 0}
                    onChange={(event) =>
                      select(
                        event.target.checked
                          ? [...requested, option.id]
                          : requested.filter((id) => id !== option.id),
                      )
                    }
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{option.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      {option.description}
                    </span>
                    {requiredBy.length > 0 && (
                      <span className="mt-1 block text-xs text-destructive">
                        Зависимость:{" "}
                        {RESET_OPTIONS.filter((item) => requiredBy.includes(item.id))
                          .map((item) => item.label)
                          .join(", ")}
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </fieldset>
          <p className="text-xs leading-5 text-muted-foreground">
            Сохранятся общий каталог предметов, аккаунты и доступы, сама группа, настройки Telegram
            и журнал действий. История Telegram сохраняется для защиты от повторного учёта.
          </p>
          <p role="status" className="text-sm">
            {selected.length
              ? `Будет сброшено: ${RESET_OPTIONS.filter((option) => selected.includes(option.id))
                  .map((option) => option.label)
                  .join(", ")}.`
              : "Ничего не выбрано."}
          </p>
          <label className="block space-y-2 text-sm">
            <span>
              Введите вручную:{" "}
              <strong className="text-destructive">{RESET_PARTY_CONFIRMATION}</strong>
            </span>
            <Input
              value={value}
              disabled={isPending || !selected.length}
              onChange={(event) => setValue(event.target.value)}
              onPaste={(event) => event.preventDefault()}
              onDrop={(event) => event.preventDefault()}
              autoComplete="off"
            />
          </label>
          {message && (
            <p role={message.ok ? "status" : "alert"} className="text-sm text-destructive">
              {message.text}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={isPending}
              onClick={() => {
                setOpen(false);
                setValue("");
              }}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              variant="destructive"
              className="min-h-11"
              disabled={isPending || !selected.length || value !== RESET_PARTY_CONFIRMATION}
            >
              {isPending ? "Сбрасываем…" : "Сбросить выбранное"}
            </Button>
          </div>
        </form>
      </EditorDialog>
    </section>
  );
}
