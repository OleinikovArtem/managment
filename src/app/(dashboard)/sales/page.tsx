import { Suspense } from "react";
import { io } from "next/cache";
import { SectionNavigation } from "@/components/layout/section-navigation";
import { AdenaAmount } from "@/components/ui/adena-amount";
import { PayoutsSkeleton } from "@/components/ui/page-skeleton";
import { PayoutList } from "@/features/sales/payout-list";
import { requirePartyPageAccess } from "@/server/auth/party-access";
import { getPartyBalances, getSales } from "@/server/services/sale-service";
import { getPayments } from "@/server/services/payment-service";

export default function SalesPage() {
  return (
    <div className="space-y-6">
      <header className="page-header">
        <h1>Финансы</h1>
        <p className="mt-2">Баланс группы, начисления и фактические передачи Adena.</p>
      </header>
      <SectionNavigation section="finance" active="/sales" />
      <Suspense fallback={<PayoutsSkeleton />}>
        <SalesContent />
      </Suspense>
    </div>
  );
}

async function SalesContent() {
  await io();
  const workspace = await requirePartyPageAccess();
  const [sales, balances, payments] = await Promise.all([
    getSales(workspace.partyId),
    getPartyBalances(workspace.partyId),
    getPayments(workspace.partyId),
  ]);
  const totalSales = sales.reduce((sum, sale) => sum + sale.totalPrice, 0n);
  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0n);
  const outstanding = balances.memberBalances.reduce((sum, member) => sum + member.payable, 0n);
  const positive = balances.memberBalances.reduce(
    (sum, member) => sum + (member.payable > 0n ? member.payable : 0n),
    0n,
  );
  const overpaid = balances.memberBalances.reduce(
    (sum, member) => sum + (member.payable < 0n ? -member.payable : 0n),
    0n,
  );
  const rows = [...balances.memberBalances].sort((left, right) =>
    left.payable > right.payable
      ? -1
      : left.payable < right.payable
        ? 1
        : left.nickname.localeCompare(right.nickname),
  );

  return (
    <div className="space-y-7">
      <dl className="finance-summary">
        <div className="finance-summary-primary">
          <dt>{balances.partyCash < 0n ? "Дефицит банка" : "В банке"}</dt>
          <dd>
            <AdenaAmount amount={balances.partyCash} />
          </dd>
        </div>
        <div>
          <dt>К выплате</dt>
          <dd>
            <AdenaAmount amount={positive} />
          </dd>
        </div>
        {overpaid > 0n && (
          <div>
            <dt>Переплаты участникам</dt>
            <dd>
              <AdenaAmount amount={overpaid} />
            </dd>
          </div>
        )}
        <div>
          <dt>Получено от продаж</dt>
          <dd>
            <AdenaAmount amount={totalSales} />
          </dd>
        </div>
        <div>
          <dt>Передано</dt>
          <dd>
            <AdenaAmount amount={totalPaid} />
          </dd>
        </div>
      </dl>
      <section className="finance-workspace" aria-labelledby="payout-heading">
        <header className="finance-section-heading">
          <div>
            <h2 id="payout-heading">Остатки участников</h2>
            <p>Начисления и уже переданная Adena по каждому участнику.</p>
          </div>
          <p className="finance-total-outstanding">
            Чистый остаток <AdenaAmount amount={outstanding} />
          </p>
        </header>
        <PayoutList
          members={rows.map((member) => ({ ...member, payable: member.payable.toString() }))}
          partyCash={balances.partyCash.toString()}
          totalOutstanding={outstanding.toString()}
          canManage={workspace.canManage}
        />
      </section>
    </div>
  );
}
