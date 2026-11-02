import Link from "next/link";
import { Suspense } from "react";
import { io } from "next/cache";
import { ArrowUpRight, BookOpenText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LocalDateTimeDisplay } from "@/features/raids/local-date-time-display";
import { ensureLocalWorkspace } from "@/server/bootstrap/local-workspace";
import { getFinancialHistory } from "@/server/services/sale-service";

const adenaFormatter = new Intl.NumberFormat("ru-RU");

export default function LedgerPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted/50" />}>
      <LedgerContent />
    </Suspense>
  );
}

async function LedgerContent() {
  await io();
  const workspace = await ensureLocalWorkspace();
  const transactions = await getFinancialHistory(workspace.partyId);

  return (
    <div className="space-y-7">
      <header>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium text-primary">{workspace.partyName}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Финансовая история</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Хронология всех проведённых продаж и выплат. Записи ledger неизменяемы.
            </p>
          </div>
          <a
            href="/api/ledger/export"
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            Экспорт CSV
          </a>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Проведённые операции</CardTitle>
          <CardDescription>
            {transactions.length} операций; каждая содержит сбалансированные проводки.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="rounded-xl border border-dashed px-6 py-10 text-center">
              <BookOpenText aria-hidden="true" className="mx-auto text-primary" />
              <h2 className="mt-4 font-medium">Финансовых операций пока нет</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Проведённые продажи и выплаты появятся в этой общей истории.
              </p>
            </div>
          ) : (
            <ol className="divide-y divide-border">
              {transactions.map((transaction) => {
                const sale = transaction.saleTransaction;
                const payment = transaction.memberPayment;
                const amount = sale?.totalPrice ?? payment?.amount;
                if (amount === undefined) {
                  throw new Error("Проведённая финансовая операция не содержит источник.");
                }

                return (
                  <li key={transaction.id} className="py-5 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-medium">
                            {sale ? "Продажа" : "Выплата"}
                          </h2>
                          <Badge variant={sale ? "secondary" : "outline"}>
                            Проведено
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {sale
                            ? `${sale.lootDrop.item.displayName || sale.lootDrop.item.canonicalName} · ${sale.quantitySold} шт.`
                            : payment?.nicknameSnapshot}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <LocalDateTimeDisplay
                            value={
                              (sale?.receivedAt ?? payment?.paidAt ?? transaction.createdAt).toISOString()
                            }
                          />
                        </p>
                        {sale?.comment && (
                          <p className="text-sm text-muted-foreground">{sale.comment}</p>
                        )}
                        {payment?.comment && (
                          <p className="text-sm text-muted-foreground">{payment.comment}</p>
                        )}
                      </div>
                      <p className="text-lg font-semibold">
                        {adenaFormatter.format(amount)} Adena
                      </p>
                    </div>

                    {sale && (
                      <Link
                        href={`/raids/${sale.raid.id}`}
                        className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        Рейд: {sale.raid.name}
                        <ArrowUpRight aria-hidden="true" size={15} />
                      </Link>
                    )}

                    <ul className="mt-3 space-y-1 rounded-lg border bg-muted/20 px-3 py-2">
                      {transaction.entries.map((entry) => {
                        const saleMember = sale?.shares.find(
                          (share) => share.memberId === entry.partyMemberId,
                        );
                        const accountName =
                          entry.accountType === "PARTY_CASH"
                            ? "Касса группы"
                            : saleMember?.nicknameSnapshot ??
                              payment?.nicknameSnapshot ??
                              entry.partyMember?.nickname ??
                              "Участник";
                        const value = entry.debit + entry.credit;
                        const increasesBalance =
                          entry.accountType === "PARTY_CASH"
                            ? entry.debit > 0n
                            : entry.credit > 0n;
                        const direction =
                          entry.accountType === "PARTY_CASH"
                            ? entry.debit > 0n
                              ? "поступление"
                              : "выплата"
                            : entry.credit > 0n
                              ? "начисление"
                              : "погашение";

                        return (
                          <li
                            key={entry.id}
                            className="flex flex-wrap justify-between gap-2 text-xs"
                          >
                            <span className="text-muted-foreground">
                              {accountName} · {direction}
                            </span>
                            <span className="font-medium">
                              {increasesBalance ? "+" : "−"}
                              {adenaFormatter.format(value)} Adena
                            </span>
                          </li>
                        );
                      })}
                    </ul>

                    {payment && payment.allocations.length > 0 && (
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {payment.allocations.map((allocation) => (
                          <li
                            key={allocation.id}
                            className="flex flex-wrap justify-between gap-2"
                          >
                            <span>
                              FIFO · {allocation.saleShare.saleTransaction.lootDrop.item.displayName ||
                                allocation.saleShare.saleTransaction.lootDrop.item.canonicalName}
                              {" · "}
                              {allocation.saleShare.saleTransaction.raid.name}
                            </span>
                            <span>{adenaFormatter.format(allocation.amount)} Adena</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
