"use client";

import { useId, useRef, useState, useTransition, type FormEvent } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { correctPaymentAction } from "@/app/(dashboard)/sales/payment-actions";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { DateInput } from "@/components/ui/date-input";
import { EditorDialog } from "@/components/ui/editor-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { localDateTimeToUtc, toLocalDateTimeInput } from "@/features/raids/local-date-time";

export type CorrectionMember = { id: string; nickname: string };

type Payment = {
  id: string;
  memberId: string;
  nickname: string;
  amount: string;
  paidAt: string;
  comment: string | null;
};

export function PaymentCorrection({
  payment,
  members,
}: {
  payment: Payment;
  members: CorrectionMember[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const editButton = useRef<HTMLButtonElement>(null);
  const amount = BigInt(payment.amount).toLocaleString("ru-RU");

  async function remove() {
    const result = await correctPaymentAction(payment.id, null);
    if (!result.ok) return result.message;
    toast.success(result.message);
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <Button
        ref={editButton}
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
      >
        <Pencil aria-hidden="true" />
        Исправить передачу
      </Button>
      <ConfirmationDialog
        trigger={
          <Button type="button" size="sm" variant="ghost" className="text-destructive">
            <Trash2 aria-hidden="true" />
            Удалить передачу
          </Button>
        }
        title="Удалить передачу Adena?"
        description={`Передача ${amount} Adena участнику ${payment.nickname} будет удалена из журнала. Сумма вернётся в банк и в остаток участника.`}
        confirmLabel="Удалить передачу"
        onConfirm={remove}
      />
      <EditorDialog
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="Исправить передачу Adena"
        description="После сохранения банк и остатки участников пересчитаются."
        finalFocus={editButton}
      >
        {open && (
          <CorrectionForm
            payment={payment}
            members={members}
            pending={pending}
            startTransition={startTransition}
            onClose={() => setOpen(false)}
          />
        )}
      </EditorDialog>
    </div>
  );
}

function CorrectionForm({
  payment,
  members,
  pending,
  startTransition,
  onClose,
}: {
  payment: Payment;
  members: CorrectionMember[];
  pending: boolean;
  startTransition: ReturnType<typeof useTransition>[1];
  onClose: () => void;
}) {
  const id = useId();
  const originalDate = toLocalDateTimeInput(payment.paidAt);
  const [paidAt, setPaidAt] = useState(originalDate);
  const [error, setError] = useState("");
  const request = useRef<{ key: string; fingerprint: string } | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const date = paidAt === originalDate ? payment.paidAt : localDateTimeToUtc(paidAt);
    if (!date) {
      setError("Укажите допустимые дату и время передачи.");
      return;
    }
    const input = {
      memberId: String(data.get("memberId")),
      amount: String(data.get("amount")),
      paidAt: date,
      comment: String(data.get("comment")),
    };
    const fingerprint = JSON.stringify(input);
    if (request.current?.fingerprint !== fingerprint) {
      request.current = { fingerprint, key: crypto.randomUUID() };
    }
    const idempotencyKey = request.current.key;
    setError("");
    startTransition(async () => {
      try {
        const result = await correctPaymentAction(payment.id, { ...input, idempotencyKey });
        if (!result.ok) {
          setError(result.message);
          return;
        }
        toast.success(result.message);
        onClose();
      } catch {
        setError("Не удалось получить ответ. Повторите сохранение.");
      }
    });
  }

  return (
    <form onSubmit={submit} onChange={() => setError("")}>
      <fieldset disabled={pending} className="grid gap-4">
        <div className="grid gap-2">
          <label htmlFor={`${id}-member`} className="text-sm font-medium">
            Получатель
          </label>
          <select
            id={`${id}-member`}
            name="memberId"
            defaultValue={payment.memberId}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.nickname}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <label htmlFor={`${id}-amount`} className="text-sm font-medium">
              Сумма Adena
            </label>
            <Input id={`${id}-amount`} name="amount" defaultValue={payment.amount} required />
          </div>
          <div className="grid gap-2">
            <label htmlFor={`${id}-date`} className="text-sm font-medium">
              Дата и время
            </label>
            <DateInput id={`${id}-date`} value={paidAt} onChange={setPaidAt} withTime required />
          </div>
        </div>
        <div className="grid gap-2">
          <label htmlFor={`${id}-comment`} className="text-sm font-medium">
            Комментарий
          </label>
          <Textarea
            id={`${id}-comment`}
            name="comment"
            defaultValue={payment.comment ?? ""}
            maxLength={500}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit">{pending ? "Сохраняем…" : "Сохранить исправление"}</Button>
        </div>
      </fieldset>
    </form>
  );
}
