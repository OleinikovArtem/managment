"use client";
import type { ReactNode, RefObject } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
export function SidePanel({
  open,
  onOpenChange,
  title,
  description,
  finalFocus,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  finalFocus?: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        finalFocus={finalFocus}
        className="data-[side=right]:w-full data-[side=right]:sm:max-w-[480px] h-dvh overflow-y-auto p-5 sm:p-6 motion-reduce:transition-none"
      >
        <SheetHeader className="mb-2 p-0 pr-8">
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}
