"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { resetPartyDataAction } from "@/app/(dashboard)/settings/actions";
import { RESET_PARTY_CONFIRMATION } from "@/features/settings/reset-confirmation";

export function ResetDataCard() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  function resetData() {
    setMessage(null);
    startTransition(async () => {
      const result = await resetPartyDataAction({ confirmation: value });
      setMessage(result.message);
      if (result.ok) { setValue(""); toast.success(result.message); router.refresh(); }
      else toast.error(result.message);
    });
  }
  return <Card className="border-destructive/40"><CardHeader className="flex flex-row items-center gap-2"><Trash2 aria-hidden="true" className="shrink-0 text-destructive" size={17} /><div className="min-w-0"><CardTitle>Очистить данные группы</CardTitle><CardDescription>Удаляет рейды, участников, продажи и историю. Каталог предметов сохраняется.</CardDescription></div></CardHeader><CardContent><form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(event) => { event.preventDefault(); resetData(); }}><div className="min-w-0 flex-1 space-y-1.5"><label htmlFor="reset-confirmation" className="text-xs font-medium">Введите вручную: <span className="font-semibold text-destructive">{RESET_PARTY_CONFIRMATION}</span></label><Input className="h-9" id="reset-confirmation" value={value} onChange={(event) => setValue(event.target.value)} onPaste={(event) => event.preventDefault()} onDrop={(event) => event.preventDefault()} autoComplete="off" placeholder={RESET_PARTY_CONFIRMATION} /></div><Button className="h-9" type="submit" variant="destructive" size="sm" disabled={isPending || value !== RESET_PARTY_CONFIRMATION}><Trash2 aria-hidden="true" size={14} />{isPending ? "Очищаем..." : "Очистить данные"}</Button></form>{message && <p role="status" className="mt-3 text-xs text-muted-foreground">{message}</p>}</CardContent></Card>;
}
