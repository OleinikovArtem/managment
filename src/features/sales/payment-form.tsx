"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { PaymentActionResult } from "@/features/sales/payment-action-result";
import { registerPaymentAction } from "@/app/(dashboard)/sales/payment-actions";

type PaymentFormProps = {
  memberId: string;
  nickname: string;
  remaining: string;
  partyCash: string;
};

function getLocalDateTimeValue(date: Date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

export function PaymentForm({
  memberId,
  nickname,
  remaining,
  partyCash,
}: PaymentFormProps) {
  const router = useRouter();
  const idempotencyKey = useRef<{ fingerprint: string; key: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const maxPayable =
    BigInt(remaining) < BigInt(partyCash) ? remaining : partyCash;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const paidDate = new Date(paidAt);
    if (!/^[1-9]\d*$/.test(amount) || !Number.isFinite(paidDate.getTime())) {
      setMessage("Проверьте сумму и дату передачи Adena.");
      return;
    }

    const request = {
      memberId,
      amount,
      paidAt: paidDate.toISOString(),
      comment: comment.trim() || undefined,
    };
    const fingerprint = JSON.stringify(request);
    if (idempotencyKey.current?.fingerprint !== fingerprint) {
      idempotencyKey.current = { fingerprint, key: crypto.randomUUID() };
    }
    const payload = { ...request, idempotencyKey: idempotencyKey.current.key };

    startTransition(async () => {
      const result: PaymentActionResult = await registerPaymentAction(payload);
      if (!result.ok) {
        setMessage(result.message);
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      idempotencyKey.current = null;
      setAmount("");
      setComment("");
      setPaidAt(getLocalDateTimeValue(new Date()));
      router.refresh();
    });
  }

  if (BigInt(maxPayable) <= 0n) return null;

  return (
    <form
      className="mt-3 grid gap-3 rounded-lg border bg-muted/20 p-3"
      onSubmit={onSubmit}
    >
      <p className="text-xs text-muted-foreground">
        Передача для {nickname}. Максимум сейчас: {maxPayable} Adena (остаток участника и общего банка).
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5 text-xs font-medium">
          Передать Adena
          <Input
            inputMode="numeric"
            pattern="[0-9]*"
            minLength={1}
            required
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            aria-label={`Сумма передачи Adena для ${nickname}`}
            placeholder="Например, 500000"
          />
        </label>
        <label className="space-y-1.5 text-xs font-medium">
          Дата передачи
          <Input
            type="datetime-local"
            required
            value={paidAt}
            onFocus={() => {
              if (!paidAt) setPaidAt(getLocalDateTimeValue(new Date()));
            }}
            onChange={(event) => setPaidAt(event.target.value)}
            aria-label={`Дата передачи Adena для ${nickname}`}
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
          aria-label={`Комментарий к передаче Adena для ${nickname}`}
          placeholder="Например, перевод или наличные"
        />
      </label>
      {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
      <div>
        <Button type="submit" size="sm" disabled={isPending || !paidAt}>
          {isPending ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : (
            <Check aria-hidden="true" />
          )}
          {isPending ? "Сохраняем передачу..." : "Записать передачу"}
        </Button>
      </div>
    </form>
  );
}
