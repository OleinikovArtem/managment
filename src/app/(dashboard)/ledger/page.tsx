import { Suspense } from "react";
import { io } from "next/cache";
import { BookOpenText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ensureLocalWorkspace } from "@/server/bootstrap/local-workspace";
import { getFinancialHistory } from "@/server/services/sale-service";
import { HistoryList, type HistoryEntry } from "@/features/ledger/history-list";

export default function LedgerPage() {
  return <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted/50" />}><HistoryContent /></Suspense>;
}

async function HistoryContent() {
  await io();
  const workspace = await ensureLocalWorkspace();
  const transactions = await getFinancialHistory(workspace.partyId);
  const entries: HistoryEntry[] = transactions.map((transaction) => {
    const sale = transaction.saleTransaction; const payment = transaction.memberPayment;
    if (!sale && !payment) throw new Error(`Financial transaction ${transaction.id} has no sale or payment.`);
    if (sale) return { id: transaction.id, kind: "sale", amount: sale.totalPrice.toString(), recordedAt: sale.receivedAt.toISOString(), title: "Продажа", subtitle: `${sale.lootDrop.item.displayName || sale.lootDrop.item.canonicalName} · ${sale.quantitySold} шт.`, comment: sale.comment, raidId: sale.raid.id, raidName: sale.raid.name, shares: sale.shares.map((share) => ({ id: share.memberId, nickname: share.nicknameSnapshot, amount: share.amount.toString() })) };
    return { id: transaction.id, kind: "payment", amount: payment!.amount.toString(), recordedAt: payment!.paidAt.toISOString(), title: "Передача Adena", subtitle: payment!.nicknameSnapshot, comment: payment!.comment, raidId: null, raidName: null, shares: [] };
  });
  return <div className="space-y-6"><header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-medium text-primary">{workspace.partyName}</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">История</h1><p className="mt-2 text-sm text-muted-foreground">Продажи, передачи Adena и движения общего банка.</p></div><a href="/api/ledger/export" className="inline-flex h-9 items-center justify-center rounded-lg border px-3 text-sm font-medium hover:bg-muted">Экспорт CSV</a></header><Card><CardHeader><CardTitle>События</CardTitle><CardDescription>Компактная лента финансовых операций.</CardDescription></CardHeader><CardContent>{entries.length === 0 ? <div className="rounded-xl border border-dashed px-6 py-10 text-center"><BookOpenText aria-hidden="true" className="mx-auto text-primary" /><h2 className="mt-4 font-medium">Событий пока нет</h2><p className="mt-1 text-sm text-muted-foreground">Продажи и передачи появятся здесь после записи операций.</p></div> : <HistoryList entries={entries} />}</CardContent></Card></div>;
}
