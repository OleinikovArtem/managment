"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, LoaderCircle, MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Textarea } from "@/components/ui/textarea";
import type { PaymentActionResult } from "@/features/sales/payment-action-result";
import { registerPaymentAction } from "@/app/(dashboard)/sales/payment-actions";
import { formatAdena, parseAdenaInput } from "@/lib/adena";
import { AdenaAmount } from "@/components/ui/adena-amount";

type PaymentFormProps = {
  memberId: string;
  nickname: string;
  remaining: string;
  partyCash: string;
  totalOutstanding: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onPendingChange?: (pending: boolean) => void;
  triggerDisabled?: boolean;
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
  totalOutstanding,
  open,
  onOpenChange,
  onPendingChange,
  triggerDisabled = false,
}: PaymentFormProps) {
  const router = useRouter();
  const idempotencyKey = useRef<{ fingerprint: string; key: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [localOpen, setLocalOpen] = useState(false);
  const showForm = open ?? localOpen;
  const triggerRef = useRef<HTMLButtonElement>(null);
  function setShowForm(next: boolean) {
    setLocalOpen(next);
    onOpenChange?.(next);
  }
  useEffect(() => {
    onPendingChange?.(isPending);
  }, [isPending, onPendingChange]);
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(() => getLocalDateTimeValue(new Date()));
  const [comment, setComment] = useState("");
  const [showComment, setShowComment] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const currentPayable = BigInt(remaining);
  const recommendedAmount = (() => {
    const outstandingTotal = BigInt(totalOutstanding);
    if (outstandingTotal <= 0n) return 0n;
    const proportional =
      ((BigInt(partyCash) > 0n ? BigInt(partyCash) : 0n) * BigInt(remaining)) / outstandingTotal;
    return proportional > BigInt(remaining) ? BigInt(remaining) : proportional;
  })();
  function openForm() {
    if (!amount && recommendedAmount > 0n) {
      setAmount((Number(recommendedAmount) / 1_000_000).toFixed(2).replace(/\.00$/, ""));
    }
    setShowForm(true);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const paidDate = new Date(paidAt);
    const enteredAmount = amount.trim();
    const normalizedAmount = parseAdenaInput(
      /[kкmмbб]$/iu.test(enteredAmount) ? enteredAmount : `${enteredAmount}м`,
    );
    if (!normalizedAmount || !Number.isFinite(paidDate.getTime())) {
      setMessage("Проверьте сумму и дату передачи Adena.");
      return;
    }

    const request = {
      memberId,
      amount: normalizedAmount,
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
      setShowComment(false);
      setShowForm(false);
      setPaidAt(getLocalDateTimeValue(new Date()));
      router.refresh();
    });
  }

  if (currentPayable <= 0n) return null;

  if (!showForm) {
    return (
      <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-dashed bg-muted/10 px-3 py-2">
        <p className="text-xs text-muted-foreground">
          Начислено сейчас: <AdenaAmount amount={currentPayable} />
        </p>
        <Button
          ref={triggerRef}
          type="button"
          size="sm"
          variant="secondary"
          disabled={triggerDisabled}
          onClick={openForm}
        >
          <Check aria-hidden="true" size={15} />
          Передать
        </Button>
      </div>
    );
  }

  return (
    <form
      className="mt-3 grid gap-2 rounded-xl border border-border/70 bg-muted/10 p-3"
      onSubmit={onSubmit}
    >
      <p className="text-xs text-muted-foreground">
        Передача для {nickname}. Можно выдать больше начисленного — разница уйдёт в долг. Сумма
        вводится в миллионах.
      </p>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1.15fr)_minmax(220px,0.85fr)]">
        <label className="space-y-1.5 text-xs font-medium">
          Передать Adena
          <Input
            inputMode="text"
            minLength={1}
            required
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            aria-label={`Сумма передачи Adena для ${nickname}`}
            placeholder={
              recommendedAmount > 0n
                ? formatAdena(recommendedAmount).replace(/м$/, "")
                : "Например, 22.5"
            }
          />
          {recommendedAmount > 0n && (
            <p className="text-[11px] font-normal text-muted-foreground">
              Рекомендуется: <AdenaAmount amount={recommendedAmount} /> · например, 22.5 = 22.5м.
            </p>
          )}
        </label>
        <label className="space-y-1.5 text-xs font-medium">
          Дата передачи
          <DateInput
            required
            value={paidAt}
            withTime
            onChange={setPaidAt}
            aria-label={`Дата передачи Adena для ${nickname}`}
          />
        </label>
      </div>
      <div>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="-ml-2 h-7 text-xs text-muted-foreground"
          onClick={() => setShowComment((visible) => !visible)}
          aria-expanded={showComment}
        >
          <MessageSquarePlus aria-hidden="true" />
          {showComment ? "Скрыть комментарий" : "Добавить комментарий"}
        </Button>
        {showComment && (
          <Textarea
            className="mt-2"
            maxLength={500}
            rows={2}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            aria-label={`Комментарий к передаче Adena для ${nickname}`}
            placeholder="Например, перевод или наличные"
          />
        )}
      </div>
      {message && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={isPending || !paidAt}>
          {isPending ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : (
            <Check aria-hidden="true" />
          )}
          {isPending ? "Сохраняем передачу..." : "Записать передачу"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={() => {
            setShowForm(false);
            requestAnimationFrame(() => triggerRef.current?.focus());
          }}
        >
          Свернуть
        </Button>
      </div>
    </form>
  );
}
