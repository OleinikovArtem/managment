"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Banknote, Check, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { SaleActionResult } from "@/features/sales/sale-action-result";
import { registerSaleAction } from "@/app/(dashboard)/sales/actions";

type SaleFormProps = {
  lootDropId: string;
  remainingQuantity: number;
};

function getLocalDateTimeValue(date: Date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

export function SaleForm({ lootDropId, remainingQuantity }: SaleFormProps) {
  const router = useRouter();
  const idempotencyKey = useRef<{ fingerprint: string; key: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [quantity, setQuantity] = useState("1");
  const [totalPrice, setTotalPrice] = useState("");
  const [receivedAt, setReceivedAt] = useState("");
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState<string | null>(null);

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

  return (
    <form className="mt-4 grid gap-3 rounded-xl border bg-muted/20 p-4" onSubmit={onSubmit}>
      <div>
        <p className="flex items-center gap-2 text-sm font-medium">
          <Banknote aria-hidden="true" size={16} />
          Записать полученную оплату
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Осталось предметов: {remainingQuantity}. Распределение будет рассчитано по
          участникам этого рейда.
        </p>
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
            inputMode="numeric"
            pattern="[0-9]*"
            minLength={1}
            required
            value={totalPrice}
            onChange={(event) => setTotalPrice(event.target.value)}
            aria-label="Полученная сумма Adena"
            placeholder="Например, 1250000"
          />
        </label>
        <label className="space-y-1.5 text-xs font-medium">
          Дата получения
          <Input
            type="datetime-local"
            required
            value={receivedAt}
            onFocus={() => {
              if (!receivedAt) setReceivedAt(getLocalDateTimeValue(new Date()));
            }}
            onChange={(event) => setReceivedAt(event.target.value)}
            aria-label="Дата получения Adena"
          />
        </label>
      </div>
      <label className="space-y-1.5 text-xs font-medium">
        Комментарий <span className="font-normal text-muted-foreground">(необязательно)</span>
        <Textarea
          maxLength={500}
          rows={2}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          aria-label="Комментарий к продаже"
          placeholder="Например, покупатель или условия продажи"
        />
      </label>
      {message && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}
      <div>
        <Button type="submit" size="sm" disabled={isPending || !receivedAt}>
          {isPending ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : (
            <Check aria-hidden="true" />
          )}
          {isPending ? "Сохраняем продажу..." : "Записать продажу"}
        </Button>
      </div>
    </form>
  );
}
