"use client";

import { useState, type ReactNode } from "react";

type Tab = "payouts" | "payments" | "sales";

export function SalesTabs({ payouts, payments, sales }: { payouts: ReactNode; payments: ReactNode; sales: ReactNode }) {
  const [active, setActive] = useState<Tab>("payouts");
  const tabs: { id: Tab; label: string }[] = [
    { id: "payouts", label: "К выплате" },
    { id: "payments", label: "Передачи" },
    { id: "sales", label: "Продажи" },
  ];
  return <section className="space-y-3"><div className="flex gap-1 overflow-x-auto rounded-xl border bg-muted/30 p-1" role="tablist" aria-label="Разделы финансов"><span className="sr-only">Финансовые разделы</span>{tabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={active === tab.id} onClick={() => setActive(tab.id)} className={`min-h-9 rounded-lg px-4 text-sm font-medium transition-colors ${active === tab.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{tab.label}</button>)}</div>{active === "payouts" && payouts}{active === "payments" && payments}{active === "sales" && sales}</section>;
}
