import { Suspense } from "react";
import { io } from "next/cache";
import { SectionNavigation } from "@/components/layout/section-navigation";
import { AdenaAmount } from "@/components/ui/adena-amount";
import { PayoutList } from "@/features/sales/payout-list";
import { requirePartyPageAccess } from "@/server/auth/party-access";
import { getPartyBalances, getSales } from "@/server/services/sale-service";
import { getPayments } from "@/server/services/payment-service";

export default function SalesPage() {
  return <Suspense fallback={<p role="status" className="empty-state">Загрузка остатков…</p>}><SalesContent /></Suspense>;
}

async function SalesContent() {
  await io();
  const workspace = await requirePartyPageAccess();
  const [sales, balances, payments] = await Promise.all([getSales(workspace.partyId), getPartyBalances(workspace.partyId), getPayments(workspace.partyId)]);
  const totalSales = sales.reduce((sum, sale) => sum + sale.totalPrice, 0n);
  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0n);
  const outstanding = balances.memberBalances.reduce((sum, member) => sum + member.payable, 0n);
  // Preserve the existing signed total used by payment recommendations.
  const positive = balances.memberBalances.reduce((sum, member) => sum + (member.payable > 0n ? member.payable : 0n), 0n);
  const overpaid = balances.memberBalances.reduce((sum, member) => sum + (member.payable < 0n ? -member.payable : 0n), 0n);
  const rows = [...balances.memberBalances].sort((a, b) => a.payable > b.payable ? -1 : a.payable < b.payable ? 1 : a.nickname.localeCompare(b.nickname));

  return <div className="space-y-6">
    <header className="page-header"><h1>Финансы</h1><p className="mt-2">Банк группы и фактические передачи Adena.</p></header>
    <SectionNavigation section="finance" active="/sales" />
    <dl className="money-strip border-b border-border">
      <div><dt>{balances.partyCash < 0n ? "Дефицит банка" : "В банке"}</dt><dd className="lead-amount"><AdenaAmount amount={balances.partyCash} /></dd></div>
      <div><dt>К выплате</dt><dd><AdenaAmount amount={positive} /></dd></div>
      {overpaid > 0n && <div><dt>Переплаты участникам</dt><dd><AdenaAmount amount={overpaid} /></dd></div>}
      <div><dt>Получено за всё время</dt><dd><AdenaAmount amount={totalSales} /></dd></div>
      <div><dt>Передано</dt><dd><AdenaAmount amount={totalPaid} /></dd></div>
    </dl>
    <PayoutList members={rows.map(member => ({ ...member, payable: member.payable.toString() }))} partyCash={balances.partyCash.toString()} totalOutstanding={outstanding.toString()} canManage={workspace.canManage} />
  </div>;
}
