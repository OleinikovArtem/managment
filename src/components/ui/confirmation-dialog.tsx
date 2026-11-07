"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
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
    <AlertDialog.Root open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      {trigger && <AlertDialog.Trigger render={trigger as never} />}
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/70" />
        <AlertDialog.Popup className="editor-dialog z-50">
          <AlertDialog.Title className="text-lg font-semibold">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
            {description}
          </AlertDialog.Description>
          {error && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Close
              render={<Button type="button" variant="outline" disabled={pending} />}
            >
              Отмена
            </AlertDialog.Close>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => void confirm()}
            >
              {pending ? "Выполняем…" : confirmLabel}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
