"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, ChevronDown, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Textarea } from "@/components/ui/textarea";
import { EditorDialog } from "@/components/ui/editor-dialog";
import { GameIcon } from "@/components/ui/game-icon";
import { createRaidAction, updateRaidAction } from "@/app/(dashboard)/raids/actions";
import { createInstanceAction, loadRaidCatalogAction, loadRaidSetupAction, manageInstanceAction, saveLootPresetAction, searchRaidItemsAction } from "@/app/(dashboard)/raids/catalog-actions";
import type { CatalogItemOption, InstanceOption, StageContext, StageOption } from "@/features/instances/catalog-schema";
import { raidFormSchema, type RaidFormValues } from "./raid-schema";
import { localDateTimeToUtc, toLocalDateTimeInput } from "./local-date-time";
import { InstancePicker } from "./instance-picker";
import { RaidProfilePicker } from "./profile-picker";
import { LootPicker } from "./loot-picker";
import "./raid-form.css";

export type RaidMemberOption = { id: string; nickname: string; status: "PRESENT" | "ABSENT"; className?: string | null; role?: string | null; level?: number | null; profiles?: { id: string; name: string; className: string; role: string | null; level: number | null; subclassSlot?: number | null }[] };
export type RaidItemOption = CatalogItemOption;
export type RaidCompositionOption = { id: string; name: string; focus: string | null; slots: { memberId: string; profileId: string | null }[] };
type Props = { members: RaidMemberOption[]; items: RaidItemOption[]; compositions?: RaidCompositionOption[]; initialValues?: Omit<RaidFormValues,"occurredAt"> & { occurredAt: string }; raidId?: string; submitLabel: string; instances: InstanceOption[]; stages: StageOption[]; defaultStage: StageContext; historicalStageName?: string | null; lastAttendance?: { memberId: string; profileId: string | null; status: "PRESENT" | "ABSENT" }[] };

export function RaidForm({ members, items, compositions = [], initialValues, raidId, submitLabel, instances: originalInstances, stages: originalStages, defaultStage, historicalStageName, lastAttendance = [] }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [stageConflict, setStageConflict] = useState(false);
  const [instances, setInstances] = useState(originalInstances);
  const [stages, setStages] = useState(originalStages);
  const [stageOpen, setStageOpen] = useState(false);
  const stageRoot = useRef<HTMLDivElement>(null);
  const [viewStage, setViewStage] = useState<StageContext>(raidId ? { stageId: initialValues?.stageId ?? null, revision: initialValues?.stageRevision ?? null } : defaultStage);
  const [recommendations, setRecommendations] = useState<CatalogItemOption[]>([]);
  const [quick, setQuick] = useState<CatalogItemOption[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [loadedCatalogKey, setLoadedCatalogKey] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [reload, setReload] = useState(0);
  const [dialog, setDialog] = useState<"create"|"manage"|"preset"|null>(null);
  const [instanceName, setInstanceName] = useState("");
  const [presetKind, setPresetKind] = useState<"custom"|"quick">("custom");
  const [presetIds, setPresetIds] = useState<string[]>([]);
  const [presetItems, setPresetItems] = useState(items);
  const [presetQuery, setPresetQuery] = useState("");
  const [dialogMessage, setDialogMessage] = useState("");
  const [catalogPending, setCatalogPending] = useState(false);
  const form = useForm<RaidFormValues>({ resolver: zodResolver(raidFormSchema), defaultValues: initialValues ? { ...initialValues, occurredAt: toLocalDateTimeInput(initialValues.occurredAt) } : { name: "", instanceName: "", instanceId: null, stageId: defaultStage.stageId, stageRevision: defaultStage.revision, occurredAt: toLocalDateTimeInput(new Date()), comment: "", participants: members.map(member => ({ memberId: member.id, status: member.status })), lootDrops: [] } });
  const instanceId = useWatch({ control: form.control, name: "instanceId" }) ?? null;
  const participants = useWatch({ control: form.control, name: "participants" }) ?? [];
  const loot = useWatch({ control: form.control, name: "lootDrops" }) ?? [];
  const compositionId = useWatch({ control: form.control, name: "compositionId" });
  const occurredAt = useWatch({ control: form.control, name: "occurredAt" });
  const instance = instances.find(row => row.id === instanceId);
  const catalogKey = `${instanceId ?? ""}/${viewStage.stageId ?? ""}/${viewStage.revision ?? ""}/${reload}`;
  const stageName = stages.find(row => row.id === viewStage.stageId)?.name ?? (raidId ? historicalStageName : null) ?? (viewStage.stageId ? "Стадия недоступна" : "Без стадии");
  const presentCount = participants.filter(row => row.status === "PRESENT").length;
  const creationKey = useRef<string | null>(null);

  useEffect(() => {
    function close(event: PointerEvent | KeyboardEvent) { if (event instanceof KeyboardEvent && event.key === "Escape") { setStageOpen(false); if (stageRoot.current?.contains(document.activeElement)) stageRoot.current.querySelector("button")?.focus(); } else if (event instanceof PointerEvent && !stageRoot.current?.contains(event.target as Node)) setStageOpen(false); }
    document.addEventListener("pointerdown",close); document.addEventListener("keydown",close);
    return () => { document.removeEventListener("pointerdown",close); document.removeEventListener("keydown",close); };
  }, []);
  useEffect(() => {
    let active = true;
    // Only recommendation state changes. Never reset, replace or re-key the form.
    const timer = setTimeout(() => {
      setCatalogLoading(true); setCatalogError("");
      loadRaidCatalogAction(instanceId, viewStage).then(result => {
        if (!active) return;
        if (!result.ok) { setCatalogError(result.message); return; }
        setRecommendations(result.data.items); setQuick(result.data.quick);
        setLoadedCatalogKey(catalogKey);
        // A new revision requires explicit acknowledgement through Refresh, not silent adoption.
        if (result.data.context.revision !== viewStage.revision && !raidId) { setStageConflict(true); setCatalogError("Набор изменился. Обновите рекомендации перед сохранением."); }
      }).catch(() => { if (active) setCatalogError("Не удалось загрузить рекомендации. Повторите запрос."); }).finally(() => { if (active) setCatalogLoading(false); });
    },0);
    return () => { active=false; clearTimeout(timer); };
  }, [instanceId, viewStage, reload, raidId, catalogKey]);
  useEffect(() => {
    if (dialog !== "preset") return;
    let active = true;
    const timer = setTimeout(() => { searchRaidItemsAction(presetQuery).then(rows => { if (active) setPresetItems(rows); }).catch(() => { if (active) setDialogMessage("Не удалось загрузить каталог."); }); },180);
    return () => { active=false; clearTimeout(timer); };
  }, [dialog,presetQuery]);

  async function refreshRecommendations() {
    setCatalogLoading(true);
    try {
      const setup = await loadRaidSetupAction(); setStages(setup.stages.available); setInstances(setup.instances);
      const current = setup.stages.available.find(row => row.id === viewStage.stageId);
      if (viewStage.stageId && !current) { setCatalogError("Стадия недоступна. Выберите другую; введённые данные сохранены."); setStageConflict(true); return; }
      const next = { stageId: current?.id ?? null, revision: current?.revision ?? null };
      if (!raidId) { form.setValue("stageId",next.stageId); form.setValue("stageRevision",next.revision); }
      setViewStage(next); setStageConflict(false); setReload(count => count+1);
    } catch { setCatalogError("Не удалось обновить рекомендации. Попробуйте ещё раз."); }
    finally { setCatalogLoading(false); }
  }
  function chooseStage(id: string) {
    const chosen = stages.find(row => row.id === id); if (!chosen) return;
    const context = { stageId: chosen.id, revision: chosen.revision };
    setViewStage(context); setStageOpen(false); setStageConflict(false);
    stageRoot.current?.querySelector("button")?.focus();
    if (!raidId) { form.setValue("stageId",context.stageId,{shouldDirty:true}); form.setValue("stageRevision",context.revision,{shouldDirty:true}); }
  }
  function chooseRoster(slots: { memberId: string; profileId: string | null; status?: "PRESENT"|"ABSENT" }[]) {
    if (raidId) return false;
    if (form.formState.dirtyFields.participants && !window.confirm("Заменить ручной выбор участников и профилей?")) return false;
    members.forEach((member,index) => { const slot=slots.find(row => row.memberId===member.id); const profile=slot?.profileId && member.profiles?.some(row => row.id===slot.profileId) ? slot.profileId : undefined; form.setValue(`participants.${index}.status`,slot?.status ?? (slot ? "PRESENT" : "ABSENT"),{shouldDirty:true,shouldValidate:true}); form.setValue(`participants.${index}.profileId`,profile,{shouldDirty:true}); });
    if (slots.some(slot=>slot.profileId&&members.some(member=>member.id===slot.memberId&&!member.profiles?.some(profile=>profile.id===slot.profileId)))) toast.info("Недоступные профили заменены на Main.");
    return true;
  }
  async function mutateDialog(work: () => Promise<void>) { setCatalogPending(true); setDialogMessage(""); try { await work(); } catch { setDialogMessage("Не удалось сохранить. Попробуйте ещё раз."); } finally { setCatalogPending(false); } }
  function submit(event: FormEvent<HTMLFormElement>) {
    if (event.target !== event.currentTarget) return;
    void form.handleSubmit(values => {
    const utc=localDateTimeToUtc(values.occurredAt); if (!utc) { setMessage("Время недопустимо или неоднозначно из-за перевода часов."); return; }
    if (!creationKey.current) creationKey.current=crypto.randomUUID();
    setMessage("");
    startTransition(async () => {
      try {
        const payload={...values,occurredAt:utc,creationKey:raidId?undefined:creationKey.current!};
        const result=raidId?await updateRaidAction(raidId,payload):await createRaidAction(payload);
        if (!result.ok) { setMessage(result.message); if(result.stageConflict) { setStageConflict(true); setCatalogError(result.message); const setup=await loadRaidSetupAction();setStages(setup.stages.available); } toast.error(result.message); return; }
        toast.success(result.message);router.push(`/raids/${result.raidId}`);router.refresh();
      } catch { setMessage("Не удалось получить ответ. Повторите сохранение: ключ запроса защитит от дубликата."); }
    });
    })(event);
  }
  return <>
    <form className="raid-create-form" onSubmit={submit} noValidate>
      <section className="raid-context-section" aria-label="Инстанс, дата и стадия"><div className="raid-context-row"><div className="raid-instance-field"><span className="raid-field-label">Инстанс</span><div className="flex items-center gap-1"><div className="min-w-0 flex-1"><InstancePicker rows={instances} value={instanceId} onChange={id => { form.setValue("instanceId",id,{shouldDirty:true}); form.setValue("instanceName",id?"":initialValues?.instanceName??"",{shouldDirty:true}); }} disabled={isPending} /></div><button type="button" className="raid-icon-button" aria-label="Свой инстанс" disabled={isPending} onClick={() => {setDialog("create");setInstanceName("");setDialogMessage("");}}><Plus size={18} aria-hidden="true" /></button></div></div><div className="raid-date-field"><label htmlFor="raid-time" className="raid-field-label">Дата и время</label><DateInput id="raid-time" withTime value={occurredAt} disabled={isPending} onChange={value => form.setValue("occurredAt",value,{shouldDirty:true,shouldValidate:true})} /></div><div className="raid-stage-field" ref={stageRoot}><span className="raid-field-label">{raidId ? "Рекомендации" : "Стадия"}</span><button type="button" className="raid-stage-button" aria-expanded={stageOpen} aria-controls="raid-stage-options" disabled={isPending || !stages.length} onClick={() => setStageOpen(open=>!open)}>{stageName}<ChevronDown size={14} aria-hidden="true" /></button>{stageOpen && <div className="raid-stage-popover" id="raid-stage-options"><p>Стадия {raidId?"для просмотра":"этого рейда"}</p>{stages.map(row => <button type="button" key={row.id} data-stage-id={row.id} aria-pressed={row.id===viewStage.stageId} onClick={()=>chooseStage(row.id)}>{row.name}{row.id===viewStage.stageId?" ✓":""}</button>)}<small>Не меняет настройки пати</small></div>}</div></div>
        <div className="flex flex-wrap items-center gap-x-4"><details className="raid-optional-name"><summary>Своё название <span>необязательно</span></summary><label className="sr-only" htmlFor="raid-name">Название рейда</label><Input id="raid-name" maxLength={120} placeholder="Например, вечерний заход" disabled={isPending} {...form.register("name")} /></details><Button type="button" variant="ghost" size="sm" onClick={()=>{setDialog("manage");setDialogMessage("");}} disabled={isPending}><Settings2 size={14} aria-hidden="true" />Мои инстансы</Button></div>
        {raidId && <p className="mt-2 text-xs text-muted-foreground">Стадия рейда: {historicalStageName || "не указана"}. Текущий выбор рекомендаций её не изменяет.</p>}
        {form.formState.errors.occurredAt && <p role="alert" className="text-sm text-destructive">{form.formState.errors.occurredAt.message}</p>}
      </section>
      <section className="raid-roster-section"><div className="raid-section-heading"><div className="flex items-center gap-2"><h2>Участники</h2><span className="raid-count">{presentCount} из {members.length}</span></div><div className="flex gap-1">{[true,false].map(present=><Button type="button" variant="ghost" size="sm" disabled={isPending} key={String(present)} onClick={()=>members.forEach((_,index)=>form.setValue(`participants.${index}.status`,present?"PRESENT":"ABSENT",{shouldDirty:true,shouldValidate:true}))}>{present?"Все":"Снять"}</Button>)}</div></div>
        {!raidId && <div className="raid-composition-line"><label htmlFor="raid-composition">Шаблон состава</label><select id="raid-composition" value={compositionId??""} disabled={isPending} onChange={event=>{const composition=compositions.find(row=>row.id===event.target.value);if(composition&&!chooseRoster(composition.slots))return;form.setValue("compositionId",event.target.value||undefined,{shouldDirty:true});}}><option value="">Выбрать вручную</option>{compositions.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select>{lastAttendance.length>0&&<Button type="button" variant="ghost" size="sm" disabled={isPending} onClick={()=>chooseRoster(lastAttendance)}>Как в прошлом рейде</Button>}</div>}
        {!members.length && <p className="empty-state">Сначала добавьте участников группы.</p>}
        <div className="raid-member-grid">{members.map((member,index)=>{const row=participants[index];const present=row?.status==="PRESENT";const profile=member.profiles?.find(profile=>profile.id===row?.profileId);const className=profile?.className??member.className;return <div key={member.id} className={`raid-member ${present?"is-present":""}`}><label><input type="checkbox" checked={present} disabled={isPending} onChange={event=>form.setValue(`participants.${index}.status`,event.target.checked?"PRESENT":"ABSENT",{shouldDirty:true,shouldValidate:true})}/>{className&&<GameIcon kind="class" name={className} size="sm"/>}<span>{member.nickname}</span><small>{present?"В рейде":"Отсутствует"}</small></label><RaidProfilePicker member={member} value={row?.profileId} disabled={isPending} onChange={id=>form.setValue(`participants.${index}.profileId`,id,{shouldDirty:true})}/></div>;})}</div>
        {form.formState.errors.participants&&<p role="alert" className="mt-2 text-sm text-destructive">{form.formState.errors.participants.message??form.formState.errors.participants.root?.message}</p>}
      </section>
      <section><div className="raid-section-heading"><div className="flex items-center gap-2"><h2>Дроп</h2><span className="raid-count">{loot.length} позиций</span></div><p className="text-xs text-muted-foreground">Добавляйте только то, что выпало</p></div>
        {catalogError&&<p role="alert" className="mb-3 text-sm text-destructive">{catalogError} <button type="button" className="underline" disabled={catalogLoading} onClick={refreshRecommendations}>Обновить рекомендации</button></p>}
        <LootPicker value={loot} onChange={rows=>form.setValue("lootDrops",rows,{shouldDirty:true,shouldValidate:true})} initialItems={items} recommended={recommendations} quick={quick} disabled={isPending} loading={catalogLoading} custom={Boolean(instance?.partyId)} onPreset={kind=>{setPresetKind(kind);setPresetIds((kind==="quick"?quick:recommendations).map(row=>row.id));setDialog("preset");setDialogMessage("");}}/>
        {form.formState.errors.lootDrops&&<p role="alert" className="mt-2 text-sm text-destructive">Проверьте количества: целое от 1 до 1 000 000; комментарий до 500 символов.</p>}
        <details className="raid-comment-disclosure"><summary>Комментарий к рейду <span>необязательно</span></summary><label className="sr-only" htmlFor="raid-comment">Комментарий к рейду</label><Textarea id="raid-comment" maxLength={1000} rows={2} disabled={isPending} {...form.register("comment")}/></details>
      </section>
      {message&&<p role="alert" className="text-sm text-destructive">{message}</p>}
      <footer className="raid-save-bar"><div><strong>{instance?.displayName||initialValues?.instanceName||"Рейд"} · {raidId?historicalStageName||"Без стадии":stageName}</strong><span>{presentCount} участников · {loot.length} позиций добычи</span></div><div className="flex gap-2"><Button type="button" variant="ghost" disabled={isPending} onClick={()=>{if(form.formState.isDirty&&!window.confirm("Выйти без сохранения?"))return;router.push(raidId?`/raids/${raidId}`:"/raids");}}>Отмена</Button><Button type="submit" disabled={isPending||!presentCount||(!raidId&&(catalogLoading||loadedCatalogKey!==catalogKey||stageConflict||Boolean(catalogError)))}>{isPending?"Сохранение…":submitLabel}</Button></div></footer>
    </form>
    <EditorDialog open={dialog!==null} onClose={()=>{if(!catalogPending)setDialog(null);}} title={dialog==="create"?"Свой инстанс":dialog==="preset"?"Набор быстрых предметов":"Мои инстансы"}>
      {dialog==="create"&&<form onSubmit={event=>{event.preventDefault();void mutateDialog(async()=>{const result=await createInstanceAction(instanceName);if(!result.ok){setDialogMessage(result.message);return;}setInstances(rows=>[...rows,result.instance]);form.setValue("instanceId",result.instance.id,{shouldDirty:true});setDialog(null);});}}><label htmlFor="custom-instance-name" className="mb-2 block text-sm">Название</label><Input id="custom-instance-name" autoFocus maxLength={120} value={instanceName} onChange={event=>setInstanceName(event.target.value)}/><Button type="submit" className="mt-4" disabled={catalogPending||!instanceName.trim()}>Добавить инстанс</Button></form>}
      {dialog==="manage"&&<div className="space-y-3">{instances.filter(row=>row.partyId).length===0&&<p className="text-sm text-muted-foreground">Своих инстансов пока нет.</p>}{instances.filter(row=>row.partyId).map(row=><div key={row.id} className="flex flex-wrap items-center gap-2 border-b border-border pb-3"><span className="min-w-0 flex-1 text-sm">{row.displayName}{!row.isActive?" · архив":""}</span><Button type="button" size="sm" variant="ghost" disabled={catalogPending} onClick={()=>{const name=window.prompt("Название инстанса",row.displayName);if(!name?.trim())return;void mutateDialog(async()=>{const result=await manageInstanceAction(row.id,{name});if(!result.ok){setDialogMessage(result.message);return;}setInstances((await loadRaidSetupAction()).instances);});}}>Переименовать</Button><Button type="button" size="sm" variant="outline" disabled={catalogPending} onClick={()=>void mutateDialog(async()=>{const result=await manageInstanceAction(row.id,{isActive:!row.isActive});if(!result.ok){setDialogMessage(result.message);return;}setInstances((await loadRaidSetupAction()).instances);})}>{row.isActive?"В архив":"Восстановить"}</Button></div>)}</div>}
      {dialog==="preset"&&<><p className="mb-3 text-xs text-muted-foreground">Выбранный порядок сохранится для вашей группы. История рейдов не меняется.</p><Input aria-label="Найти предмет для набора" placeholder="Найти предмет…" value={presetQuery} onChange={event=>setPresetQuery(event.target.value)} maxLength={200}/><div className="my-3 max-h-56 overflow-auto">{presetItems.map(item=><label key={item.id} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={presetIds.includes(item.id)} onChange={event=>setPresetIds(ids=>event.target.checked?[...ids,item.id]:ids.filter(id=>id!==item.id))}/>{item.displayName||item.canonicalName}</label>)}</div><p className="text-xs text-muted-foreground">Выбрано: {presetIds.length}</p><div className="mt-4 flex gap-2"><Button disabled={catalogPending} onClick={()=>void mutateDialog(async()=>{const result=await saveLootPresetAction(presetKind==="quick"?null:instanceId,presetIds);if(!result.ok){setDialogMessage(result.message);return;}setReload(count=>count+1);setDialog(null);})}>Сохранить набор</Button><Button variant="ghost" disabled={catalogPending} onClick={()=>setPresetIds([])}>Очистить набор</Button></div></>}
      {dialogMessage&&<p role="alert" className="mt-3 text-sm text-destructive">{dialogMessage}</p>}
    </EditorDialog>
  </>;
}
