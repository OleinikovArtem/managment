"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DateInput } from "@/components/ui/date-input";
import { AdenaAmount } from "@/components/ui/adena-amount";
import { LocalDateTimeDisplay } from "@/features/raids/local-date-time-display";

export type DashboardSale = { id: string; receivedAt: string; totalPrice: string; quantitySold: number; raidName: string; instanceName: string | null; itemName: string; category: string; shares: { nickname: string; amount: string }[] };
type Props = { sales: DashboardSale[]; totalRaids: number; totalDrops: number; totalPaid: string; partyCash: string; outstanding: string; activeMembers: number; totalMembers: number; recentRaids: { id: string; name: string; occurredAt: string; present: number; drops: number }[] };

export function DashboardAnalytics({ sales, totalRaids, totalDrops, totalPaid, partyCash, outstanding, activeMembers, totalMembers, recentRaids }: Props) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [raid, setRaid] = useState("all");
  const [category, setCategory] = useState("all");
  const [member, setMember] = useState("all");
  const options = useMemo(() => ({ raids: [...new Set(sales.map(s => s.instanceName || s.raidName))].sort(), categories: [...new Set(sales.map(s => s.category))].sort(), members: [...new Set(sales.flatMap(s => s.shares.map(share => share.nickname)))].sort() }), [sales]);
  const filtered = useMemo(() => sales.filter(sale => {
    const local = new Date(sale.receivedAt);
    const date = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
    return (!from || date >= from) && (!to || date <= to) && (raid === "all" || (sale.instanceName || sale.raidName) === raid) && (category === "all" || sale.category === category) && (member === "all" || sale.shares.some(share => share.nickname === member));
  }), [sales, from, to, raid, category, member]);
  const revenue = filtered.reduce((sum, sale) => sum + BigInt(sale.totalPrice), 0n);
  const byInstance = new Map<string, bigint>();
  const byItem = new Map<string, { amount: bigint; quantity: number }>();
  const byMember = new Map<string, bigint>();
  for (const sale of filtered) {
    const instance = sale.instanceName || sale.raidName;
    byInstance.set(instance, (byInstance.get(instance) ?? 0n) + BigInt(sale.totalPrice));
    const item = byItem.get(sale.itemName) ?? { amount: 0n, quantity: 0 };
    item.amount += BigInt(sale.totalPrice); item.quantity += sale.quantitySold; byItem.set(sale.itemName, item);
    for (const share of sale.shares) if (member === "all" || share.nickname === member) byMember.set(share.nickname, (byMember.get(share.nickname) ?? 0n) + BigInt(share.amount));
  }
  const descending = (a: bigint, b: bigint) => a > b ? -1 : a < b ? 1 : 0;
  const instances = [...byInstance].sort((a, b) => descending(a[1], b[1])).slice(0, 6);
  const items = [...byItem].sort((a, b) => descending(a[1].amount, b[1].amount)).slice(0, 6);
  const members = [...byMember].sort((a, b) => descending(a[1], b[1])).slice(0, 6);
  const maxInstance = instances[0]?.[1] ?? 1n;
  const hasFilters = Boolean(from || to || raid !== "all" || category !== "all" || member !== "all");
  const reset = () => { setFrom(""); setTo(""); setRaid("all"); setCategory("all"); setMember("all"); };

  return <>
    <section aria-label="Текущее состояние казны" className="flex flex-wrap items-start justify-between gap-6 border-b border-border pb-6">
      <div><p className="text-sm text-muted-foreground">В банке сейчас</p><p className="mt-2 text-3xl font-semibold tabular-nums"><AdenaAmount amount={partyCash} /></p><Link href="/sales" className="mt-3 inline-flex min-h-10 items-center text-sm underline underline-offset-4">Перейти к выплатам</Link></div>
      <dl className="money-strip"><div><dt>Остаток долей, за всё время</dt><dd><AdenaAmount amount={outstanding} /></dd></div><div><dt>Передано участникам</dt><dd><AdenaAmount amount={totalPaid} /></dd></div></dl>
    </section>
    <p className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground"><span>{activeMembers} активных из {totalMembers} участников</span><span>Рейдов: {totalRaids}</span><span>Поступлений лута: {totalDrops}</span></p>
    <section><div className="mb-4 flex items-center justify-between gap-4"><h2 className="section-heading">Последние рейды</h2><Link href="/raids" className="text-sm text-muted-foreground underline underline-offset-4">Все рейды</Link></div>
      {recentRaids.length === 0 ? <p className="empty-state">Создайте первый рейд, чтобы записать состав и добычу.</p> : <ul className="data-list">{recentRaids.map(raid => <li key={raid.id}><Link href={`/raids/${raid.id}`} className="list-row min-h-11"><div><p className="text-sm font-medium">{raid.name}</p><p className="mt-1 text-xs text-muted-foreground">{raid.present} участников · поступлений: {raid.drops}</p></div><span className="text-xs text-muted-foreground"><LocalDateTimeDisplay value={raid.occurredAt} /></span></Link></li>)}</ul>}
    </section>
    <details className="disclosure border-t border-border pt-3">
      <summary><span className="section-heading">Аналитика продаж</span></summary>
      <div className="pt-4">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs text-muted-foreground">Получено по выбранным продажам</p><p className="mt-1 text-2xl font-semibold"><AdenaAmount amount={revenue} /></p></div><p className="text-sm text-muted-foreground">Продаж: {filtered.length}{hasFilters ? " · фильтры применены" : " · за всё время"}</p></div>
        <details className="disclosure mb-5"><summary className="text-sm">Фильтры {hasFilters && <span className="text-muted-foreground">{[from && `с ${from}`, to && `по ${to}`, raid !== "all" && raid, category !== "all" && category, member !== "all" && member].filter(Boolean).join(" · ")}</span>}</summary>
          <div className="grid gap-3 py-4 sm:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-2 text-sm">Дата от<DateInput value={from} onChange={setFrom} aria-label="Дата от" /></label><label className="space-y-2 text-sm">Дата до<DateInput value={to} onChange={setTo} aria-label="Дата до" /></label>
            <Filter label="Рейд / инстанс" value={raid} onChange={setRaid} options={options.raids} /><Filter label="Категория" value={category} onChange={setCategory} options={options.categories} /><Filter label="Участник" value={member} onChange={setMember} options={options.members} />
            {hasFilters && <button type="button" onClick={reset} className="min-h-10 self-end text-left text-sm underline underline-offset-4">Сбросить фильтры</button>}
          </div>
        </details>
        {member !== "all" && <p className="mb-5 text-sm text-muted-foreground">Выручка включает полные суммы продаж с участием {member}. Его начисления показаны отдельно.</p>}
        {filtered.length === 0 ? <p className="empty-state">{sales.length ? "По выбранным фильтрам продаж нет." : "Продажи появятся после записи полученной оплаты в рейде."}</p> : <div className="grid items-start gap-8 xl:grid-cols-2">
          <section><h3 className="section-heading mb-4">По инстансам</h3>{instances.map(([name, amount]) => <div key={name} className="mb-4"><div className="mb-2 flex items-start justify-between gap-4 text-sm"><span>{name}</span><AdenaAmount amount={amount} /></div><div className="h-1 bg-muted"><div className="h-full bg-[#e6be67]" style={{ width: `${Number(amount * 100n / maxInstance)}%` }} /></div></div>)}</section>
          <section><h3 className="section-heading mb-3">Начисления участникам</h3><ul>{members.map(([name, amount]) => <li key={name} className="flex justify-between gap-4 border-b border-border py-3 text-sm"><span>{name}</span><AdenaAmount amount={amount} /></li>)}</ul></section>
          <section className="xl:col-span-2"><h3 className="section-heading mb-3">Предметы по выручке</h3><ul>{items.map(([name, data]) => <li key={name} className="flex justify-between gap-4 border-b border-border py-3 text-sm"><span>{name}<span className="ml-2 text-muted-foreground">· {data.quantity} шт.</span></span><AdenaAmount amount={data.amount} /></li>)}</ul></section>
        </div>}
      </div>
    </details>
  </>;
}

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <label className="space-y-2 text-sm"><span className="block">{label}</span><select className="w-full" value={value} onChange={e => onChange(e.target.value)}><option value="all">Все</option>{options.map(option => <option key={option} value={option}>{option}</option>)}</select></label>;
}
