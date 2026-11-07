"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, LoaderCircle, MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Textarea } from "@/components/ui/textarea";
import { SidePanel } from "@/components/ui/side-panel";
import type { PaymentActionResult } from "@/features/sales/payment-action-result";
import { registerPaymentAction } from "@/app/(dashboard)/sales/payment-actions";
import { parseAdenaInput } from "@/lib/adena";
import { AdenaAmount } from "@/components/ui/adena-amount";

type PaymentFormProps = {
  memberId: string;
  nickname: string;
  remaining: string;
  partyCash: string;
  totalOutstanding: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
}: PaymentFormProps) {
  const router = useRouter();
  const idempotencyKey = useRef<{ fingerprint: string; key: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const currentPayable = BigInt(remaining);
  const recommendedAmount = (() => {
    const outstandingTotal = BigInt(totalOutstanding);
    if (outstandingTotal <= 0n) return 0n;
    const proportional =
      ((BigInt(partyCash) > 0n ? BigInt(partyCash) : 0n) * BigInt(remaining)) / outstandingTotal;
    return proportional > BigInt(remaining) ? BigInt(remaining) : proportional;
  })();
  const [amount, setAmount] = useState(() => floorToMillionsInput(recommendedAmount));
  const [paidAt, setPaidAt] = useState(() => getLocalDateTimeValue(new Date()));
  const [comment, setComment] = useState("");
  const [showComment, setShowComment] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
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
      onOpenChange(false);
      setPaidAt(getLocalDateTimeValue(new Date()));
      router.refresh();
    });
  }

  if (currentPayable <= 0n) return null;

  return (
    <SidePanel
      open={open}
      onOpenChange={(next) => {
        if (!isPending) onOpenChange(next);
      }}
      title="Передача Adena"
      description={`Получатель: ${nickname}`}
    >
      <form className="grid gap-5" onSubmit={onSubmit}>
        <section
          className="flex items-baseline justify-between gap-3 rounded-xl border border-border bg-card/80 px-4 py-3 text-sm text-muted-foreground"
          aria-label="Остаток участника"
        >
          <span>Текущий остаток к выплате</span>
          <AdenaAmount amount={currentPayable} className="text-lg font-semibold text-foreground" />
        </section>
        <p className="text-sm text-muted-foreground">
          Сумма по умолчанию рассчитана от доступного банка и округлена вниз. Её можно изменить;
          сумма выше остатка банка создаст долг.
        </p>
        <label className="grid gap-1.5 text-sm font-medium">
          Сумма передачи, в миллионах
          <Input
            inputMode="text"
            minLength={1}
            required
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            aria-label={`Сумма передачи Adena для ${nickname}`}
            placeholder={recommendedAmount > 0n ? "Введите сумму" : "В банке пока нет Adena"}
            autoFocus
          />
          {recommendedAmount > 0n && (
            <span className="text-xs font-normal text-muted-foreground">
              Текущий банк группы: <AdenaAmount amount={partyCash} />. Расчётная доля при текущем
              балансе: <AdenaAmount amount={recommendedAmount} />.
            </span>
          )}
          <span className="text-xs font-normal text-muted-foreground">
            Можно ввести, например, 22.5 или 22.5м.
          </span>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Дата передачи
          <DateInput
            required
            value={paidAt}
            withTime
            onChange={setPaidAt}
            aria-label={`Дата передачи Adena для ${nickname}`}
          />
        </label>
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
              rows={3}
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
        <div className="mt-1 flex flex-wrap items-center gap-2.5">
          <Button type="submit" size="lg" disabled={isPending || !paidAt}>
            {isPending ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : (
              <Check aria-hidden="true" />
            )}
            {isPending ? "Записываем..." : "Записать передачу"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            Отмена
          </Button>
        </div>
      </form>
    </SidePanel>
  );
}

function floorToMillionsInput(amount: bigint) {
  if (amount <= 0n) return "";
  const wholeMillions = amount / 1_000_000n;
  if (wholeMillions > 0n) return `${wholeMillions}`;

  const whole = amount / 1_000_000n;
  const remainder = amount % 1_000_000n;
  const fraction = remainder.toString().padStart(6, "0").replace(/0+$/, "");
  return `${whole}.${fraction}`;
}
