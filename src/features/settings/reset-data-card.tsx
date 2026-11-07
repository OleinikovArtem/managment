"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Input } from "@/components/ui/input";
import { previewPartyResetAction, resetPartyDataAction } from "@/app/(dashboard)/settings/actions";
import { RESET_PARTY_CONFIRMATION } from "@/features/settings/reset-confirmation";
import { RESET_OPTIONS, resolveResetCategories, type ResetCategory } from "./reset-plan";

type Preview = Awaited<ReturnType<typeof previewPartyResetAction>>;

export function ResetDataCard() {
  const router = useRouter();
  const [requested, setRequested] = useState<ResetCategory[]>([]);
  const [value, setValue] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const requestId = useRef(0);
  const selected = requested.length ? resolveResetCategories(requested) : [];

  useEffect(() => {
    const id = ++requestId.current;
    if (!requested.length)
      return () => {
        requestId.current += 1;
      };
    startTransition(async () => {
      try {
        const result = await previewPartyResetAction(requested);
        if (requestId.current === id) setPreview(result);
      } catch {
        if (requestId.current === id)
          setPreview({
            ok: false,
            message: "Не удалось загрузить предпросмотр. Повторите запрос.",
          });
      }
    });
    return () => {
      requestId.current += 1;
    };
  }, [requested]);

  useEffect(() => {
    function clearConfirmation() {
      setValue("");
      setConfirmOpen(false);
    }
    function onHistoryNavigation() {
      if (new URLSearchParams(window.location.search).get("tab") !== "reset") clearConfirmation();
    }
    window.addEventListener("settings-reset-exit", clearConfirmation);
    window.addEventListener("popstate", onHistoryNavigation);
    return () => {
      window.removeEventListener("settings-reset-exit", clearConfirmation);
      window.removeEventListener("popstate", onHistoryNavigation);
    };
  }, []);

  function select(next: ResetCategory[]) {
    setRequested(next);
    setValue("");
    setMessage(null);
    setPreview(null);
  }

  async function resetData() {
    const result = await resetPartyDataAction({ confirmation: value, categories: requested });
    if (!result.ok) {
      setMessage(result.message);
      throw new Error(result.message);
    }
    setValue("");
    setRequested([]);
    toast.success(result.message);
    router.refresh();
  }

  const countLabels: Record<string, string> = {
    payments: "Выплаты",
    paymentAllocations: "Покрытия долей",
    ledgerTransactions: "Финансовые операции",
    ledgerEntries: "Проводки",
    sales: "Продажи",
    saleShares: "Доли продаж",
    loot: "Поступления лута",
    raids: "Рейды",
    participants: "Снимки участников",
    compositions: "Составы",
    compositionSlots: "Слоты составов",
    members: "Участники",
    profiles: "Профили",
    telegramProcessed: "Обработанные Telegram-сообщения",
    telegramPending: "Нерешённые Telegram-сообщения",
  };

  return (
    <section className="space-y-5 border-t border-border pt-5" aria-labelledby="danger-zone-title">
      <header>
        <h2 id="danger-zone-title" className="text-base font-semibold text-destructive">
          Опасная зона
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Выберите данные группы. Зависимые категории добавятся автоматически; предпросмотр
          показывает текущие количества. Сброс необратим.
        </p>
      </header>
      <fieldset disabled={isPending} className="space-y-1">
        <legend className="mb-2 text-sm font-medium">Что сбросить</legend>
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
        Сохранятся общий и собственный каталоги предметов, аккаунты и доступы, группа, настройки
        Telegram, соответствия предметов, история импорта и журнал действий. При сбросе продаж
        обработанные Telegram-сообщения сохраняют защиту от повтора, нерешённые переходят в статус
        «Игнорировано».
      </p>
      <section
        aria-live="polite"
        aria-busy={isPending}
        className="rounded-md border border-border p-4"
      >
        <h3 className="text-sm font-semibold">Предпросмотр удаления</h3>
        {!requested.length ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Выберите категории, чтобы увидеть затрагиваемые записи.
          </p>
        ) : !preview ? (
          <p className="mt-2 text-sm text-muted-foreground">Загружаем актуальные количества…</p>
        ) : !preview.ok ? (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {preview.message}
          </p>
        ) : (
          <>
            <p className="mt-2 text-xs text-muted-foreground">
              Снимок на момент запроса. При подтверждении сервер заново проверит доступ и
              зависимости.
            </p>
            <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              {Object.entries(preview.preview.counts).map(([key, count]) => (
                <li key={key} className="flex justify-between gap-3">
                  <span>{countLabels[key] ?? key}</span>
                  <strong className="tabular-nums">{count}</strong>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      <label className="block max-w-md space-y-2 text-sm">
        <span>
          Введите вручную: <strong className="text-destructive">{RESET_PARTY_CONFIRMATION}</strong>
        </span>
        <Input
          value={value}
          disabled={isPending || !requested.length || !preview?.ok}
          onChange={(event) => setValue(event.target.value)}
          onPaste={(event) => event.preventDefault()}
          onDrop={(event) => event.preventDefault()}
          autoComplete="off"
        />
      </label>
      {message && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}
      <ConfirmationDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Подтвердить сброс данных?"
        description={`Будут сброшены: ${RESET_OPTIONS.filter((option) =>
          selected.includes(option.id),
        )
          .map((option) => option.label)
          .join(
            ", ",
          )}. Снимок количества не блокирует новые изменения; перед выполнением сервер повторно проверит доступ и зависимости.`}
        confirmLabel="Сбросить выбранное"
        onConfirm={resetData}
      />
      <Button
        variant="destructive"
        className="min-h-11"
        disabled={
          isPending || !requested.length || !preview?.ok || value !== RESET_PARTY_CONFIRMATION
        }
        onClick={() => setConfirmOpen(true)}
      >
        <Trash2 aria-hidden="true" size={16} />
        Сбросить выбранное
      </Button>
    </section>
  );
}
