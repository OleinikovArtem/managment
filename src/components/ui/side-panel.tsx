"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ReactNode, RefObject } from "react";

export function SidePanel({
  open,
  onOpenChange,
  title,
  description,
  finalFocus,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  finalFocus?: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70 transition-opacity duration-200 ease-out data-starting-style:opacity-0 data-ending-style:opacity-0 motion-reduce:transition-none" />
        <Dialog.Popup
          finalFocus={finalFocus}
          className="fixed inset-0 z-50 flex h-dvh w-auto translate-y-0 flex-col overflow-y-auto border-l border-border bg-popover p-5 opacity-100 shadow-2xl outline-none transition-[opacity,transform] duration-200 ease-out data-starting-style:translate-y-2 data-starting-style:opacity-0 data-ending-style:translate-y-2 data-ending-style:opacity-0 motion-reduce:transition-none sm:inset-y-0 sm:left-auto sm:w-[480px] sm:translate-y-0 sm:translate-x-0 sm:p-6 sm:data-starting-style:translate-y-0 sm:data-starting-style:translate-x-4 sm:data-ending-style:translate-y-0 sm:data-ending-style:translate-x-4"
        >
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
