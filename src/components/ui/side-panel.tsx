"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

export function SidePanel({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70" />
        <Dialog.Popup className="fixed inset-0 z-50 flex h-dvh w-auto flex-col overflow-y-auto border-l border-border bg-popover p-5 shadow-2xl outline-none sm:inset-y-0 sm:left-auto sm:w-[480px] sm:p-6">
          <header className="mb-6 flex items-start justify-between gap-5">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
              {description && (
                <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close className="action-menu-trigger" aria-label="Закрыть панель">
              <X size={18} aria-hidden="true" />
            </Dialog.Close>
          </header>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
