"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { SaleForm } from "@/features/sales/sale-form";

type SaleWorkspaceState = {
  activeId: string | null;
  setActiveId: React.Dispatch<React.SetStateAction<string | null>>;
  pending: boolean;
  setPending: React.Dispatch<React.SetStateAction<boolean>>;
};

const SaleWorkspace = createContext<SaleWorkspaceState | null>(null);

export function RaidSaleWorkspace({ children }: { children: ReactNode }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <SaleWorkspace.Provider value={{ activeId, setActiveId, pending, setPending }}>
      {children}
    </SaleWorkspace.Provider>
  );
}

export function RaidSaleEditor({
  lootDropId,
  remainingQuantity,
}: {
  lootDropId: string;
  remainingQuantity: number;
}) {
  const workspace = useContext(SaleWorkspace);
  if (!workspace) throw new Error("RaidSaleEditor requires RaidSaleWorkspace.");

  return (
    <SaleForm
      lootDropId={lootDropId}
      remainingQuantity={remainingQuantity}
      open={workspace.activeId === lootDropId}
      onOpenChange={(open) =>
        workspace.setActiveId((current) =>
          open ? lootDropId : current === lootDropId ? null : current,
        )
      }
      onPendingChange={workspace.setPending}
      triggerDisabled={workspace.pending}
    />
  );
}
