"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Banknote, Check, LoaderCircle, MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Textarea } from "@/components/ui/textarea";
import type { SaleActionResult } from "@/features/sales/sale-action-result";
import { registerSaleAction } from "@/app/(dashboard)/sales/actions";

type SaleFormProps = {
  lootDropId: string;
  remainingQuantity: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onPendingChange?: (pending: boolean) => void;
  triggerDisabled?: boolean;
};

function getLocalDateTimeValue(date: Date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

export function SaleForm({ lootDropId, remainingQuantity, open, onOpenChange, onPendingChange, triggerDisabled = false }: SaleFormProps) {
  const router = useRouter();
  const idempotencyKey = useRef<{ fingerprint: string; key: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [localOpen, setLocalOpen] = useState(false);
  const showForm = open ?? localOpen;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const wasOpen = useRef(false);
  const [quantity, setQuantity] = useState("1");
  const [totalPrice, setTotalPrice] = useState("");
  const [receivedAt, setReceivedAt] = useState(() => getLocalDateTimeValue(new Date()));
  const [comment, setComment] = useState("");
  const [showComment, setShowComment] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function setShowForm(next: boolean) {
    setLocalOpen(next);
    onOpenChange?.(next);
  }

  useEffect(() => {
    onPendingChange?.(isPending);
  }, [isPending, onPendingChange]);

  useEffect(() => {
    if (showForm && !wasOpen.current) amountRef.current?.focus();
    wasOpen.current = showForm;
  }, [showForm]);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const quantitySold = Number(quantity);
    const receivedDate = new Date(receivedAt);
    if (!Number.isInteger(quantitySold) || !Number.isFinite(receivedDate.getTime())) {
      setMessage("Проверьте количество и дату получения Adena.");
      return;
    }

    const request = {
      lootDropId,
      quantitySold,
      totalPrice,
      receivedAt: receivedDate.toISOString(),
      comment: comment.trim() || undefined,
    };
    const fingerprint = JSON.stringify(request);
    if (idempotencyKey.current?.fingerprint !== fingerprint) {
      idempotencyKey.current = { fingerprint, key: crypto.randomUUID() };
    }
    const payload = { ...request, idempotencyKey: idempotencyKey.current.key };

    startTransition(async () => {
      const result: SaleActionResult = await registerSaleAction(payload);
      if (!result.ok) {
        setMessage(result.message);
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      idempotencyKey.current = null;
      setQuantity("1");
      setTotalPrice("");
      setComment("");
      setShowComment(false);
      setShowForm(false);
      setReceivedAt(getLocalDateTimeValue(new Date()));
      router.refresh();
    });
  }

  if (remainingQuantity <= 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Всё количество этого выпадения уже записано как проданное.
      </p>
    );
  }

  if (!showForm) {
    return (
      <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-dashed bg-muted/10 px-3 py-2">
        <p className="text-xs text-muted-foreground">Доступно к продаже: <span className="font-semibold text-foreground">{remainingQuantity} шт.</span></p>
        <Button ref={triggerRef} type="button" size="sm" variant="secondary" disabled={triggerDisabled} onClick={() => setShowForm(true)}>
          <Banknote aria-hidden="true" size={15} />
          Отметить продажу
        </Button>
      </div>
    );
  }

  return (
    <form className="mt-3 grid gap-2 rounded-xl border bg-muted/20 p-3" onSubmit={onSubmit}>
      <div>
        <p className="flex items-center gap-2 text-sm font-medium">
          <Banknote aria-hidden="true" size={16} />
          Записать полученную оплату
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Осталось: {remainingQuantity} шт. · доли рассчитаются по составу рейда.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1.5 text-xs font-medium">
          Продано
          <Input
            type="number"
            min={1}
            max={remainingQuantity}
            step={1}
            required
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            aria-label="Проданное количество"
          />
        </label>
        <label className="space-y-1.5 text-xs font-medium">
          Получено Adena
          <Input
            ref={amountRef}
            inputMode="numeric"
            pattern="[0-9.,a-zа-яА-Я]*"
            minLength={1}
            required
            value={totalPrice}
            onChange={(event) => setTotalPrice(event.target.value)}
            aria-label="Полученная сумма Adena"
            placeholder="Например, 5.25м"
          />
        </label>
        <label className="space-y-1.5 text-xs font-medium">
          Дата получения
          <DateInput required value={receivedAt} withTime onChange={setReceivedAt} aria-label="Дата получения Adena" />
        </label>
      </div>
      <div>
        <Button type="button" variant="ghost" size="xs" className="-ml-2 h-7 text-xs text-muted-foreground" onClick={() => setShowComment((visible) => !visible)} aria-expanded={showComment}>
          <MessageSquarePlus aria-hidden="true" />
          {showComment ? "Скрыть комментарий" : "Добавить комментарий"}
        </Button>
        {showComment && <Textarea className="mt-2" maxLength={500} rows={2} value={comment} onChange={(event) => setComment(event.target.value)} aria-label="Комментарий к продаже" placeholder="Например, покупатель или условия продажи" />}
      </div>
      {message && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : (
            <Check aria-hidden="true" />
          )}
          {isPending ? "Сохраняем продажу..." : "Записать продажу"}
        </Button>
        {onOpenChange && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={isPending}
            title="Свернуть форму, сохранив введённые данные"
            onClick={() => {
              setShowForm(false);
              requestAnimationFrame(() => triggerRef.current?.focus());
            }}
          >
            Свернуть
          </Button>
        )}
      </div>
    </form>
  );
}
