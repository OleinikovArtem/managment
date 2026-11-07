"use client";

import { Menu } from "@base-ui/react/menu";
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
      <Menu.Root>
        <Menu.Trigger
          ref={triggerRef}
          aria-label={label}
          disabled={disabled}
          className="action-menu-trigger"
        >
          <MoreHorizontal size={18} aria-hidden="true" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner sideOffset={6} align="end" className="z-50">
            <Menu.Popup className="action-menu-popup">
              {items.map((item) => (
                <Menu.Item
                  key={item.label}
                  onClick={item.confirmation ? () => setSelected(item) : item.onClick}
                  disabled={item.disabled}
                  className={`action-menu-item ${item.destructive ? "text-destructive" : ""}`}
                >
                  {item.label}
                </Menu.Item>
              ))}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
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
