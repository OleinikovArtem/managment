"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { removeTelegramTokenAction, saveTelegramTokenAction } from "@/app/(dashboard)/settings/telegram-actions";

export function TelegramBotSettings({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setMessage("");
    startTransition(async () => {
      const result = await saveTelegramTokenAction(data.get("token"));
      setMessage(result.message);
      if (result.ok) { form.reset(); router.refresh(); }
    });
  }
  function disconnect() {
    if (!window.confirm("Удалить токен Telegram для этой группы?")) return;
    startTransition(async () => { const result = await removeTelegramTokenAction(); setMessage(result.message); if (result.ok) router.refresh(); });
  }
  return <section className="max-w-3xl space-y-6">
    <div><p className="text-sm font-medium">Состояние: {configured ? "токен сохранён" : "не подключён"}</p><p className="mt-1 text-sm text-muted-foreground">Сохранённый токен нельзя посмотреть повторно. При замене вставьте новый.</p></div>
    <form onSubmit={submit} className="max-w-xl space-y-3"><label className="block space-y-1.5 text-sm font-medium"><span>{configured ? "Новый токен BotFather" : "Токен BotFather"}</span><Input name="token" type="password" autoComplete="new-password" required minLength={20} maxLength={256} disabled={pending} /></label><Button type="submit" disabled={pending}>{pending ? "Сохраняем…" : configured ? "Заменить токен" : "Сохранить токен"}</Button></form>
    {configured && <Button type="button" variant="outline" disabled={pending} onClick={disconnect}>Отключить бота</Button>}
    {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
    <details className="border-t border-border pt-5"><summary className="cursor-pointer text-sm font-medium">Как создать бота и получить токен</summary><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-muted-foreground"><li>Откройте Telegram, найдите BotFather <strong className="text-foreground">@BotFather</strong> и отправьте <code>/newbot</code>.</li><li>Задайте отображаемое имя и уникальный username, который заканчивается на <code>bot</code>.</li><li>Скопируйте выданный BotFather API token и вставьте его выше. Никому не пересылайте токен.</li><li>Добавьте бота в тот же групповой чат, где публикует продажи Igri. В настройках бота через BotFather включите возможность взаимодействовать с сообщениями других ботов, если этот режим доступен.</li></ol><p className="mt-3 text-xs leading-5 text-muted-foreground">На этом этапе токен сохраняется зашифрованным. Приём сообщений, проверка чата и автоматическая обработка продаж ещё не подключены.</p></details>
  </section>;
}
