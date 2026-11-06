"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { TelegramAllocation } from "@/server/telegram/sale-parser";

type Notification = { id: string; status: string; reason: string | null; allocations: TelegramAllocation[]; updatedAt: string };
export function TelegramNotifications({ partyId }: { partyId: string }) {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const seen = useRef(new Set<string>());
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let fetching = false;
    async function refresh() {
      if (fetching || document.hidden) return;
      fetching = true;
      try {
        const response = await fetch("/api/telegram/notifications", { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const payload: { partyId: string; items: Notification[] } = await response.json();
        if (!active || payload.partyId !== partyId) return;
        setCount(payload.items.length);
        for (const item of payload.items.slice(0, 3)) {
          const key = `${item.id}/${item.updatedAt}`;
          if (seen.current.has(key)) continue;
          seen.current.add(key);
          if (Date.now() - new Date(item.updatedAt).getTime() > 120_000) continue;
          const summary = item.allocations.map(row => `${row.itemName} × ${row.quantity}: ${row.amount} Adena · ${row.raidName}`).join("; ");
          toast(item.status === "NEEDS_REVIEW" ? "Telegram: требуется разбор" : item.status === "PENDING" ? "Telegram: ожидает обработки" : "Продажа из Telegram учтена", { description: item.reason ?? summary, action: { label: "Открыть", onClick: () => router.push("/telegram") } });
        }
      } catch { /* Keep the persistent history link available while offline. */ }
      finally { fetching = false; }
    }
    void refresh();
    const interval = window.setInterval(refresh, 20_000);
    window.addEventListener("focus", refresh);
    window.addEventListener("telegram-read", refresh);
    return () => { active = false; controller.abort(); window.clearInterval(interval); window.removeEventListener("focus", refresh); window.removeEventListener("telegram-read", refresh); };
  }, [partyId, router]);
  return <div className="mb-4 flex justify-end"><Link href="/telegram" className="inline-flex min-h-11 items-center gap-2 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Продажи Telegram{count > 0 && <span className="rounded bg-muted px-2 py-0.5 text-foreground" aria-label={`${count} непрочитанных уведомлений`}>{count === 20 ? "20+" : count}</span>}</Link></div>;
}
