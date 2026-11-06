"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AdenaAmount } from "@/components/ui/adena-amount";
import { LocalDateTime } from "@/components/ui/local-date-time";
import { dismissTelegramImportAction, readTelegramImportsAction, retryTelegramImportAction, saveTelegramAliasAction, removeTelegramAliasAction } from "@/app/(dashboard)/telegram/actions";
import type { listTelegramImports } from "@/server/telegram/query-service";

type Record = Awaited<ReturnType<typeof listTelegramImports>>[number];
type ActionResult = { ok: boolean; message: string };
function ImportRow({ record, canManage }: { record: Record; canManage: boolean }) {
  const router = useRouter();
  const [text, setText] = useState(record.correctedText ?? record.rawText);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const retryable = record.status === "NEEDS_REVIEW" || record.status === "PENDING";
  function run(work: () => Promise<ActionResult>) {
    setResult(null);
    startTransition(async () => {
      try { const response = await work(); setResult(response); router.refresh(); }
      catch { setResult({ ok: false, message: "Не удалось выполнить действие. Повторите после обновления страницы." }); }
    });
  }
  return <article className="space-y-3 border-b border-border py-5">
    <div className="flex flex-wrap items-start justify-between gap-2"><div><p className={`text-sm font-semibold ${record.status === "NEEDS_REVIEW" ? "text-destructive" : ""}`}>{record.status === "PROCESSED" ? "Продажа учтена" : record.status === "NEEDS_REVIEW" ? "Требует разбора" : record.status === "PENDING" ? "Ожидает обработки" : "Исключено"}</p><p className="mt-1 text-xs text-muted-foreground"><LocalDateTime value={record.receivedAt} /> · сообщение {record.messageId}</p></div><span className="text-xs text-muted-foreground">Telegram</span></div>
    {record.reason && <p className="text-sm leading-6 text-muted-foreground">{record.reason}</p>}
    {record.allocations.map((allocation, index) => <div key={`${allocation.lootDropId}/${index}`} className="grid gap-1 text-sm sm:grid-cols-[1fr_auto]"><div><span className="font-medium">{allocation.itemName}</span> × {allocation.quantity}<Link className="ml-2 underline underline-offset-4 text-muted-foreground" href={`/raids/${allocation.raidId}`}>{allocation.raidName}</Link></div><AdenaAmount amount={allocation.amount} /></div>)}
    <details><summary className="cursor-pointer text-sm underline underline-offset-4">{retryable && canManage ? "Исходное сообщение и повторный разбор" : "Исходное сообщение"}</summary>
      <pre className="mt-3 whitespace-pre-wrap break-words text-xs leading-6 text-muted-foreground">{record.rawText}</pre>
      {retryable && canManage && <form className="mt-4 space-y-3" onSubmit={event => { event.preventDefault(); run(() => retryTelegramImportAction(record.id, text)); }}><label className="block space-y-1.5 text-sm"><span>Текст для повторного разбора</span><Textarea value={text} onChange={event => setText(event.target.value)} rows={7} required maxLength={16000} disabled={pending} /></label><p className="text-xs leading-5 text-muted-foreground">Исходный текст сохраняется. После исправления формата или соответствия названия нажмите «Повторить»: все строки будут учтены одной операцией.</p><div className="flex flex-wrap gap-2"><Button type="submit" disabled={pending}>{pending ? "Обрабатываем…" : "Повторить обработку"}</Button><Button type="button" variant="ghost" disabled={pending} onClick={() => { if (window.confirm("Исключить сообщение из импорта без создания продаж?")) run(() => dismissTelegramImportAction(record.id)); }}>Исключить сообщение</Button></div></form>}
    </details>
    {result && <p role={result.ok ? "status" : "alert"} className={`text-sm ${result.ok ? "text-muted-foreground" : "text-destructive"}`}>{result.message}</p>}
  </article>;
}

export function TelegramImportHistory({ records, canManage, items, aliases }: {
  records: Record[]; canManage: boolean;
  items: { id: string; canonicalName: string }[];
  aliases: { id: string; name: string; item: { canonicalName: string } }[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState("ALL");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<ActionResult | null>(null);
  const visible = records.filter(record => filter === "ALL" || record.status === filter);
  const needsReview = records.filter(record => record.status === "NEEDS_REVIEW").length;
  return <div className="max-w-4xl space-y-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-3 text-sm"><span>Показать</span><select className="rounded-lg border border-input bg-background px-3 py-2" value={filter} onChange={event => setFilter(event.target.value)}><option value="ALL">Все сообщения</option><option value="PENDING">Ожидают обработки</option><option value="NEEDS_REVIEW">Требуют разбора ({needsReview})</option><option value="PROCESSED">Учтённые</option><option value="IGNORED">Исключённые</option></select></label><div className="flex gap-2"><Button variant="ghost" onClick={() => router.refresh()} disabled={pending}>Обновить</Button><Button variant="outline" disabled={pending || !records.length} onClick={() => startTransition(async () => { try { await readTelegramImportsAction(); setMessage({ ok: true, message: "Уведомления отмечены прочитанными." }); router.refresh(); window.dispatchEvent(new Event("telegram-read")); } catch { setMessage({ ok: false, message: "Не удалось отметить уведомления." }); } })}>Отметить прочитанными</Button></div></div>
    <section aria-label="Сообщения Telegram">{visible.length ? visible.map(record => <ImportRow key={`${record.id}/${record.updatedAt}`} record={record} canManage={canManage} />) : <div className="border-y border-border py-10"><h2 className="text-base font-semibold">{records.length ? "Нет сообщений с этим статусом" : "Уведомлений о продажах пока нет"}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{records.length ? "Выберите другой фильтр." : "После подключения бота новые продажи Igri появятся здесь. Успешные продажи учитываются автоматически, ошибки остаются для разбора."}</p><Link href="/settings/telegram" className="mt-4 inline-block text-sm underline underline-offset-4">Настройки Telegram →</Link></div>}</section>
    <p className="text-xs text-muted-foreground">Показаны последние 100 сообщений группы. Исправление уже учтённого сообщения в Telegram не переписывает финансовую историю.</p>
    {canManage && <details className="border-t border-border pt-6"><summary className="cursor-pointer text-base font-semibold">Соответствия названий предметов ({aliases.length})</summary><p className="my-4 text-sm leading-6 text-muted-foreground">Если Igri использует другое название, свяжите его с предметом общего каталога. Соответствие действует только в этой группе.</p>
      <form className="space-y-3" onSubmit={event => {
        event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
        startTransition(async () => { try { const result = await saveTelegramAliasAction(String(data.get("name") ?? ""), String(data.get("itemId") ?? "")); setMessage(result); if (result.ok) { form.reset(); router.refresh(); } } catch { setMessage({ ok: false, message: "Не удалось сохранить соответствие." }); } });
      }}><div className="grid gap-3 sm:grid-cols-2"><label className="block space-y-1.5 text-sm"><span>Название из Telegram</span><Input name="name" required maxLength={240} disabled={pending} /></label><label className="block space-y-1.5 text-sm"><span>Предмет каталога</span><select name="itemId" aria-label="Предмет каталога" required disabled={pending} defaultValue="" className="min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2"><option value="">Выберите предмет…</option>{items.map(item => <option key={item.id} value={item.id}>{item.canonicalName}</option>)}</select></label></div><Button type="submit" disabled={pending}>Сохранить соответствие</Button></form>
      <ul className="mt-5 divide-y divide-border">{aliases.map(alias => <li key={alias.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><span>{alias.name} → {alias.item.canonicalName}</span><Button variant="ghost" disabled={pending} onClick={() => startTransition(async () => { try { setMessage(await removeTelegramAliasAction(alias.id)); router.refresh(); } catch { setMessage({ ok: false, message: "Не удалось удалить соответствие." }); } })}>Удалить</Button></li>)}</ul>
    </details>}
    {message && <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-muted-foreground" : "text-destructive"}`}>{message.message}</p>}
  </div>;
}
