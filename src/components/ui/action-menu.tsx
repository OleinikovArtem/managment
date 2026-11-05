"use client";

import { Menu } from "@base-ui/react/menu";
import { MoreHorizontal } from "lucide-react";

export function ActionMenu({ label, items, disabled = false }: {
  label: string;
  disabled?: boolean;
  items: { label: string; onClick: () => void; destructive?: boolean; disabled?: boolean }[];
}) {
  return <Menu.Root>
    <Menu.Trigger aria-label={label} disabled={disabled} className="action-menu-trigger"><MoreHorizontal size={18} aria-hidden="true" /></Menu.Trigger>
    <Menu.Portal><Menu.Positioner sideOffset={6} align="end" className="z-50"><Menu.Popup className="action-menu-popup">
      {items.map((item) => <Menu.Item key={item.label} onClick={item.onClick} disabled={item.disabled} className={`action-menu-item ${item.destructive ? "text-destructive" : ""}`}>{item.label}</Menu.Item>)}
    </Menu.Popup></Menu.Positioner></Menu.Portal>
  </Menu.Root>;
}
