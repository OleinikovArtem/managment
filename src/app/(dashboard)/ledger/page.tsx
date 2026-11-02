import Link from "next/link";
import { Suspense } from "react";
import { io } from "next/cache";
import { ArrowUpRight, BookOpenText, Coins } from "lucide-react";
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
      <HistoryContent />
    </Suspense>
  );
}

async function HistoryContent() {
  await io();
  const workspace = await ensureLocalWorkspace();
  const transactions = await getFinancialHistory(workspace.partyId);

  return (
    <div className="space-y-7">
      <header>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium text-primary">{workspace.partyName}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              История продаж и передач Adena
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Что продали, кому сколько причитается и сколько Adena уже передали участникам.
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
          <CardTitle>История</CardTitle>
          <CardDescription>
            Продажи предметов и Adena, переданная участникам: {transactions.length}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="rounded-xl border border-dashed px-6 py-10 text-center">
              <BookOpenText aria-hidden="true" className="mx-auto text-primary" />
              <h2 className="mt-4 font-medium">Продаж и передач пока нет</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Добавьте продажу в карточке рейда или запишите передачу Adena на странице продаж.
              </p>
            </div>
          ) : (
            <ol className="divide-y divide-border">
              {transactions.map((transaction) => {
                const sale = transaction.saleTransaction;
                const payment = transaction.memberPayment;
                if (!sale && !payment) {
                  throw new Error(
                    `Financial transaction ${transaction.id} has no sale or payment.`,
                  );
                }

                const amount = sale ? sale.totalPrice : payment?.amount;
                const recordedAt = sale ? sale.receivedAt : payment?.paidAt;
                if (amount === undefined || recordedAt === undefined) {
                  throw new Error(
                    `Financial transaction ${transaction.id} has incomplete details.`,
                  );
                }
                const itemName = sale
                  ? sale.lootDrop.item.displayName || sale.lootDrop.item.canonicalName
                  : null;

                return (
                  <li key={transaction.id} className="py-5 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-medium">{sale ? "Продажа" : "Передача Adena"}</h2>
                          <Badge variant={sale ? "secondary" : "outline"}>
                            {sale ? "Продано" : "Получено участником"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {sale
                            ? `${itemName} · ${sale.quantitySold} шт.`
                            : payment?.nicknameSnapshot ?? "Участник"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <LocalDateTimeDisplay value={recordedAt.toISOString()} />
                        </p>
                        {(sale?.comment || payment?.comment) && (
                          <p className="text-sm text-muted-foreground">
                            {sale?.comment ?? payment?.comment}
                          </p>
                        )}
                      </div>
                      <p className="text-lg font-semibold">
                        {adenaFormatter.format(amount)} Adena
                      </p>
                    </div>

                    {sale && (
                      <>
                        <Link
                          href={`/raids/${sale.raid.id}`}
                          className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          Рейд: {sale.raid.name}
                          <ArrowUpRight aria-hidden="true" size={15} />
                        </Link>
                        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-3">
                          <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                            <Coins aria-hidden="true" size={16} />
                            Доли с этой продажи
                          </p>
                          <ul className="space-y-1">
                            {sale.shares.map((share) => (
                              <li
                                key={share.memberId}
                                className="flex flex-wrap justify-between gap-2 text-sm"
                              >
                                <span className="text-muted-foreground">
                                  {share.nicknameSnapshot}
                                </span>
                                <span className="font-medium">
                                  {adenaFormatter.format(share.amount)} Adena
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </>
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
