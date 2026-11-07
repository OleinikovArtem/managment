import { Suspense } from "react";
import { io } from "next/cache";
import { SectionNavigation } from "@/components/layout/section-navigation";
import { LedgerSkeleton } from "@/components/ui/page-skeleton";
import { HistoryList, type HistoryEntry } from "@/features/ledger/history-list";
import { requirePartyPageAccess } from "@/server/auth/party-access";
import { getFinancialHistory } from "@/server/services/sale-service";

export default function LedgerPage() {
  return (
    <div className="space-y-6">
      <header className="page-header flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1>Финансы</h1>
          <p className="mt-2">История продаж, начислений и передач участникам.</p>
        </div>
        <a
          href="/api/ledger/export"
          className="inline-flex min-h-10 items-center rounded-md border border-border px-3 text-sm hover:bg-muted"
        >
          Экспорт всех операций
        </a>
      </header>
      <SectionNavigation section="finance" active="/ledger" />
      <Suspense fallback={<LedgerSkeleton />}>
        <LedgerContent />
      </Suspense>
    </div>
  );
}

async function LedgerContent() {
  await io();
  const workspace = await requirePartyPageAccess();
  const transactions = await getFinancialHistory(workspace.partyId);
  const entries: HistoryEntry[] = transactions.map((transaction) => {
    const sale = transaction.saleTransaction;
    const payment = transaction.memberPayment;
    if (!sale && !payment)
      throw new Error(`Financial transaction ${transaction.id} has no sale or payment.`);
    if (sale)
      return {
        id: transaction.id,
        kind: "sale",
        amount: sale.totalPrice.toString(),
        recordedAt: sale.receivedAt.toISOString(),
        title: "Продажа",
        subtitle: `${sale.lootDrop.item.displayName || sale.lootDrop.item.canonicalName} · ${sale.quantitySold} шт.`,
        comment: sale.comment,
        raidId: sale.raid.id,
        raidName: sale.raid.name,
        shares: sale.shares.map((share) => ({
          id: share.memberId,
          nickname: share.nicknameSnapshot,
          amount: share.amount.toString(),
        })),
      };
    return {
      id: transaction.id,
      kind: "payment",
      amount: payment!.amount.toString(),
      recordedAt: payment!.paidAt.toISOString(),
      title: "Передача Adena",
      subtitle: payment!.nicknameSnapshot,
      comment: payment!.comment,
      raidId: null,
      raidName: null,
      shares: [],
    };
  });
  return <HistoryList entries={entries} />;
}
