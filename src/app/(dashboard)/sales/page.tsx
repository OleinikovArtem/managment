import Link from "next/link";
import { Suspense } from "react";
import { io } from "next/cache";
import { ArrowUpRight, Banknote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LocalDateTimeDisplay } from "@/features/raids/local-date-time-display";
import { PaymentForm } from "@/features/sales/payment-form";
import { ensureLocalWorkspace } from "@/server/bootstrap/local-workspace";
import { getPartyBalances, getSales } from "@/server/services/sale-service";
import { getPayments } from "@/server/services/payment-service";

const adenaFormatter = new Intl.NumberFormat("ru-RU");

export default function SalesPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted/50" />}>
      <SalesContent />
    </Suspense>
  );
}

async function SalesContent() {
  await io();
  const workspace = await ensureLocalWorkspace();
  const [sales, balances, payments] = await Promise.all([
    getSales(workspace.partyId),
    getPartyBalances(workspace.partyId),
    getPayments(workspace.partyId),
  ]);

  const totalSales = sales.reduce((sum, sale) => sum + sale.totalPrice, 0n);
  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0n);
  const outstanding = balances.memberBalances.reduce(
    (sum, member) => sum + member.payable,
    0n,
  );

  return (
    <div className="space-y-7">
      <header>
        <p className="text-sm font-medium text-primary">{workspace.partyName}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Продажи</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Записи о фактически полученной оплате. Продажу можно внести со страницы исходного рейда.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Получено от продаж</CardDescription>
            <CardTitle className="text-2xl">{adenaFormatter.format(totalSales)} Adena</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Остаток в кассе</CardDescription>
            <CardTitle className="text-2xl">{adenaFormatter.format(balances.partyCash)} Adena</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Начислено к выплате участникам</CardDescription>
            <CardTitle className="text-2xl">{adenaFormatter.format(outstanding)} Adena</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Фактически выплачено</CardDescription>
            <CardTitle className="text-2xl">{adenaFormatter.format(totalPaid)} Adena</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {balances.memberBalances.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Начисления участникам</CardTitle>
            <CardDescription>Суммы восстановлены из проведённых записей ledger.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {balances.memberBalances.map((member) => (
                <li key={member.memberId} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="w-full space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-sm">
                        {member.nickname}
                        {!member.isActive && <Badge variant="outline">Неактивен</Badge>}
                      </span>
                      <span className="text-sm font-medium">
                        {adenaFormatter.format(member.payable)} Adena
                      </span>
                    </div>
                    {member.payable > 0n && (
                      <PaymentForm
                        memberId={member.memberId}
                        nickname={member.nickname}
                        remaining={member.payable.toString()}
                        partyCash={balances.partyCash.toString()}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
          <CardHeader>
            <CardTitle>История выплат</CardTitle>
            <CardDescription>
              {payments.length} проведённых выплат; начисления погашаются в порядке FIFO.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <p className="rounded-xl border border-dashed px-6 py-8 text-center text-sm text-muted-foreground">
                Выплат пока нет. Они появятся здесь после фактической передачи Adena участнику.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {payments.map((payment) => (
                  <li key={payment.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-medium">{payment.nicknameSnapshot}</p>
                        <p className="text-sm text-muted-foreground">
                          {adenaFormatter.format(payment.amount)} Adena
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <LocalDateTimeDisplay value={payment.paidAt.toISOString()} />
                        </p>
                        {payment.comment && (
                          <p className="text-sm text-muted-foreground">{payment.comment}</p>
                        )}
                      </div>
                      <Badge variant="outline">
                        {payment.allocations.length} начислений FIFO
                      </Badge>
                    </div>
                    <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                      {payment.allocations.map((allocation) => (
                        <li
                          key={allocation.id}
                          className="flex flex-wrap justify-between gap-2"
                        >
                          <span>
                            {allocation.saleShare.saleTransaction.lootDrop.item.displayName ||
                              allocation.saleShare.saleTransaction.lootDrop.item.canonicalName}
                            {" · "}
                            {allocation.saleShare.saleTransaction.raid.name}
                          </span>
                          <span>{adenaFormatter.format(allocation.amount)} Adena</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>История продаж</CardTitle>
          <CardDescription>Записей: {sales.length}. Каждая сумма хранится в Adena без дробной части.</CardDescription>
        </CardHeader>
        <CardContent>
          {sales.length === 0 ? (
            <div className="rounded-xl border border-dashed px-6 py-10 text-center">
              <Banknote aria-hidden="true" className="mx-auto text-primary" />
              <h2 className="mt-4 font-medium">Продаж пока нет</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Откройте рейд и запишите продажу после фактического получения Adena.
              </p>
              <Link href="/raids" className="mt-4 inline-flex text-sm font-medium text-primary hover:underline">
                Перейти к рейдам
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {sales.map((sale) => (
                <li key={sale.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium">
                        {sale.lootDrop.item.displayName || sale.lootDrop.item.canonicalName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Продано: {sale.quantitySold} шт. · {adenaFormatter.format(sale.totalPrice)} Adena
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <LocalDateTimeDisplay value={sale.receivedAt.toISOString()} />
                      </p>
                      {sale.comment && (
                        <p className="text-sm text-muted-foreground">{sale.comment}</p>
                      )}
                    </div>
                    <Link
                      href={`/raids/${sale.raid.id}`}
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      {sale.raid.name}
                      <ArrowUpRight aria-hidden="true" size={15} />
                    </Link>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {sale.shares.map((share) => (
                      <Badge key={share.id} variant="outline">
                        {share.nicknameSnapshot}: {adenaFormatter.format(share.amount)}
                      </Badge>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
