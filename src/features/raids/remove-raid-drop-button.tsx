"use client";

import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { removeRaidDropAction } from "@/app/(dashboard)/raids/actions";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

export function RemoveRaidDropButton({
  raidId,
  dropId,
  itemName,
  quantity,
}: {
  raidId: string;
  dropId: string;
  itemName: string;
  quantity: number;
}) {
  return (
    <ConfirmationDialog
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2 min-h-9 self-start text-destructive"
          aria-label={`Удалить предмет «${itemName}» из рейда`}
        >
          <Trash2 aria-hidden="true" />
          Удалить
        </Button>
      }
      title="Удалить предмет из рейда?"
      description={`Из добычи рейда будет удалено «${itemName}» · ${quantity} шт. Предмет останется в каталоге.`}
      confirmLabel="Удалить предмет"
      onConfirm={async () => {
        const result = await removeRaidDropAction(raidId, dropId);
        if (!result.ok) return result.message;
        toast.success(result.message);
      }}
    />
  );
}
