"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LocalDateTime } from "@/components/ui/local-date-time";
import { removeTelegramTokenAction, saveTelegramTokenAction, reconnectTelegramAction, testTelegramAction, saveTelegramSourceAction, type TelegramActionResult } from "@/app/(dashboard)/settings/telegram-actions";
import type { getTelegramSettings } from "@/server/telegram/query-service";
import { TELEGRAM_SALE_EXAMPLE } from "@/server/telegram/sale-parser";

type Settings = Awaited<ReturnType<typeof getTelegramSettings>>;
export function TelegramBotSettings({ settings }: { settings: Settings }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<TelegramActionResult | null>(null);
  const [chatId, setChatId] = useState(settings?.chatId ?? "");
  const [senderId, setSenderId] = useState(settings?.senderId ?? "");
  function run(work: () => Promise<TelegramActionResult>, onSuccess?: () => void) {
    setResult(null);
    startTransition(async () => {
      try { const response = await work(); setResult(response); if (response.ok) { onSuccess?.(); router.refresh(); } }
      catch { setResult({ ok: false, message: "Не удалось выполнить запрос. Проверьте соединение и повторите." }); }
    });
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    run(() => saveTelegramTokenAction(data.get("token")), () => form.reset());
  }
  return <div className="max-w-3xl space-y-8">
    <section className="space-y-4" aria-labelledby="telegram-connection">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="telegram-connection" className="text-base font-semibold">1. Receiving bot</h2><span className="text-sm text-muted-foreground">{settings?.webhookEnabled ? "Webhook подключён" : settings ? "Токен сохранён · webhook выключен" : "Не подключён"}</span></div>
      {settings?.botUsername && <p className="text-sm">@{settings.botUsername}</p>}
      <form onSubmit={submit} className="max-w-xl space-y-3"><label className="block space-y-1.5 text-sm font-medium"><span>{settings ? "Новый токен BotFather" : "Токен BotFather"}</span><Input name="token" type="password" autoComplete="new-password" required minLength={20} maxLength={256} disabled={pending} /></label><Button type="submit" disabled={pending}>{pending ? "Подождите…" : settings ? "Заменить и подключить" : "Подключить бота"}</Button></form>
      {settings && <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={pending} onClick={() => run(testTelegramAction)}>Проверить соединение</Button><Button variant="outline" disabled={pending} onClick={() => run(reconnectTelegramAction)}>Подключить webhook</Button><Button variant="ghost" disabled={pending} onClick={() => { if (window.confirm("Отключить автоматический импорт Telegram? Учтённые продажи сохранятся.")) run(removeTelegramTokenAction); }}>Отключить</Button></div>}
      <p className="text-xs leading-5 text-muted-foreground">Токен хранится зашифрованным и повторно не показывается. Приём работает на сервере, даже когда приложение закрыто.</p>
    </section>
    <section className="space-y-4 border-t border-border pt-6" aria-labelledby="telegram-source">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="telegram-source" className="text-base font-semibold">2. Чат и источник продаж</h2><Button variant="ghost" disabled={pending} onClick={() => router.refresh()}>Обновить список</Button></div>
      <p className="text-sm leading-6 text-muted-foreground">Добавьте receiving bot в чат с Igri. После нового сообщения от бота чат появится ниже. Выбирайте именно Igri: остальные отправители и пересланные сообщения не учитываются. Импорт начнётся со следующего сообщения после выбора.</p>
      {!!settings?.discoveries.length && <label className="block space-y-1.5 text-sm"><span>Обнаруженные источники</span><select className="w-full rounded-lg border border-input bg-background px-3 py-2" defaultValue="" disabled={pending} onChange={event => { const source = settings.discoveries[Number(event.target.value)]; if (source) { setChatId(source.chatId); setSenderId(source.senderId); } }}><option value="">Выберите чат и бота…</option>{settings.discoveries.map((source, index) => <option key={`${source.chatId}/${source.senderId}`} value={index}>{source.chatTitle} · @{source.senderUsername} · {source.senderId}</option>)}</select></label>}
      <form className="space-y-3" onSubmit={event => { event.preventDefault(); run(() => saveTelegramSourceAction(chatId.trim(), senderId.trim())); }}>
        <div className="grid gap-3 sm:grid-cols-2"><label className="block space-y-1.5 text-sm"><span>ID группового чата</span><Input required placeholder="-1001234567890" value={chatId} onChange={event => setChatId(event.target.value)} disabled={pending || !settings?.webhookEnabled} /></label><label className="block space-y-1.5 text-sm"><span>ID бота Igri</span><Input required placeholder="123456789" value={senderId} onChange={event => setSenderId(event.target.value)} disabled={pending || !settings?.webhookEnabled} /></label></div>
        <Button type="submit" disabled={pending || !settings?.webhookEnabled}>Сохранить источник</Button>
      </form>
      {!settings?.webhookEnabled && <p className="text-xs text-muted-foreground">Выбор источника доступен после подключения webhook.</p>}
      {settings?.chatId && <p className="text-sm">Выбрано: {settings.chatTitle} · @{settings.senderUsername}</p>}
      {settings?.lastReceivedAt && <p className="text-xs text-muted-foreground">Последнее сообщение: <LocalDateTime value={settings.lastReceivedAt} /></p>}
      <Link href="/telegram" className="inline-block text-sm underline underline-offset-4">История импорта и соответствия предметов →</Link>
    </section>
    {result && <p role={result.ok ? "status" : "alert"} className={`text-sm ${result.ok ? "text-muted-foreground" : "text-destructive"}`}>{result.message}</p>}
    <details className="border-t border-border pt-5"><summary className="cursor-pointer text-sm font-medium">Как настроить бота</summary><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-muted-foreground"><li>Создайте отдельного бота через <strong>@BotFather</strong> → <code>/newbot</code>.</li><li>В BotFather включите Bot-to-Bot Communication Mode. Добавьте бота в чат с Igri и выдайте необходимые права администратора либо отключите privacy mode.</li><li>Вставьте токен и подключите бота. Один receiving bot используется только для одной группы Party Bank.</li><li>Дождитесь сообщения Igri, обновите список и выберите чат и бота-источник. Можно указать известные числовые ID вручную.</li><li>Обычные продажи учитываются без подтверждения. Ошибки формата, неизвестные названия и нехватка лута появятся в истории импорта.</li></ol></details>
    <details className="border-t border-border pt-5"><summary className="cursor-pointer text-sm font-medium">Ожидаемый английский формат сообщения</summary><pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-muted-foreground">{TELEGRAM_SALE_EXAMPLE}</pre><p className="mt-3 text-xs leading-5 text-muted-foreground">Price / Price per item — цена за единицу, Subtotal / Row total — сумма строки, Total / Sum — контрольный итог. Current Adena не учитывается. Названия полей — предварительный перевод примера.</p></details>
  </div>;
}
