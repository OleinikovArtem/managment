"use client";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { useRef, useState } from "react";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

export function ActionMenu({
  label,
  items,
  disabled = false,
}: {
  label: string;
  disabled?: boolean;
  items: {
    label: string;
    onClick: () => void | Promise<void>;
    destructive?: boolean;
    disabled?: boolean;
    confirmation?: { title: string; description: string; confirmLabel?: string };
  }[];
}) {
  const [selected, setSelected] = useState<(typeof items)[number] | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          ref={triggerRef}
          aria-label={label}
          disabled={disabled}
          className="action-menu-trigger"
        >
          <MoreHorizontal size={18} aria-hidden="true" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="min-w-48">
          {items.map((item) => (
            <DropdownMenuItem
              key={item.label}
              onClick={item.confirmation ? () => setSelected(item) : item.onClick}
              disabled={item.disabled}
              variant={item.destructive ? "destructive" : "default"}
              className="min-h-11 px-3"
            >
              {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {selected?.confirmation && (
        <ConfirmationDialog
          open
          title={selected.confirmation.title}
          description={selected.confirmation.description}
          confirmLabel={selected.confirmation.confirmLabel ?? selected.label}
          onOpenChange={(open) => {
            if (!open) {
              setSelected(null);
              requestAnimationFrame(() => triggerRef.current?.focus());
            }
          }}
          onConfirm={async () => {
            await selected.onClick();
            setSelected(null);
          }}
        />
      )}
    </>
  );
}
