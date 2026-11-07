"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { savePartyStageAction } from "@/app/(dashboard)/raids/catalog-actions";
import type { StageOption } from "@/features/instances/catalog-schema";
export function StageDefaultForm({ stages, selected, revision, canManage, effectiveName }: { stages: StageOption[]; selected: string | null; revision: number; canManage: boolean; effectiveName: string }) {
  const [value,setValue]=useState(selected??"");
  const [currentRevision,setCurrentRevision]=useState(revision);
  const [message,setMessage]=useState("");
  const [pending,startTransition]=useTransition();
  return <section className="border-t border-border pt-5"><h2 className="text-base font-semibold">Стадия для новых рейдов</h2><p className="mt-2 max-w-xl text-sm text-muted-foreground">В автоматическом режиме новые формы используют текущую стадию сервера. Уже открытые черновики и история не изменяются.</p><form className="mt-4 flex max-w-xl flex-wrap items-end gap-3" onSubmit={event=>{event.preventDefault();startTransition(async()=>{try{const result=await savePartyStageAction(value||null,currentRevision);setMessage(result.message);if(result.ok&&result.revision!==undefined)setCurrentRevision(result.revision);}catch{setMessage("Не удалось сохранить настройку.");}});}}><label className="flex-1 text-sm">По умолчанию<select className="mt-2 w-full" value={value} onChange={event=>setValue(event.target.value)} disabled={!canManage||pending}><option value="">Автоматически · {effectiveName}</option>{selected&&!stages.some(row=>row.id===selected)&&<option value={selected}>Стадия недоступна</option>}{stages.map(stage=><option key={stage.id} value={stage.id}>{stage.name}</option>)}</select></label>{canManage&&<Button type="submit" variant="outline" disabled={pending}>{pending?"Сохранение…":"Сохранить"}</Button>}</form>{message&&<p role="status" className="mt-3 text-sm">{message}</p>}</section>;
}
