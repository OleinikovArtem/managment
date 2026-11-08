"use client";
import type { ReactNode, RefObject } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
} from "@/components/ui/dialog";
export function EditorDialog({
  open,
  onClose,
  title,
  description,
  finalFocus,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  finalFocus?: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        finalFocus={finalFocus}
        className="max-h-[90dvh] overflow-y-auto p-5 sm:max-w-2xl motion-reduce:animate-none"
      >
        <DialogHeader className="pr-8">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
