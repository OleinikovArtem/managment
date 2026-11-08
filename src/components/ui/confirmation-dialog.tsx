"use client";

import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function ConfirmationDialog({
  trigger,
  open: controlledOpen,
  onOpenChange,
  title,
  description,
  confirmLabel = "Удалить",
  onConfirm,
}: {
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void>;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  function setOpen(next: boolean) {
    setInternalOpen(next);
    onOpenChange?.(next);
    if (!next) setError(null);
  }
  async function confirm() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      setOpen(false);
    } catch {
      setError("Не удалось выполнить действие. Проверьте данные и повторите.");
    } finally {
      setPending(false);
    }
  }
  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      {trigger && <AlertDialogTrigger render={trigger as never} />}
      <AlertDialogContent className="max-h-[90dvh] overflow-y-auto motion-reduce:animate-none">
        <AlertDialogTitle className="text-lg font-semibold">{title}</AlertDialogTitle>
        <AlertDialogDescription className="mt-2 text-sm leading-6 text-muted-foreground">
          {description}
        </AlertDialogDescription>
        {error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <AlertDialogCancel render={<Button type="button" variant="outline" disabled={pending} />}>
            Отмена
          </AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() => void confirm()}
          >
            {pending ? "Выполняем…" : confirmLabel}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
