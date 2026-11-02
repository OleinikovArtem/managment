import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { io } from "next/cache";
import { ArrowLeft, Pencil, ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SaleForm } from "@/features/sales/sale-form";
import { LocalDateTimeDisplay } from "@/features/raids/local-date-time-display";
import { ensureLocalWorkspace } from "@/server/bootstrap/local-workspace";
import { getRaid, RaidNotFoundError } from "@/server/services/raid-service";

type RaidDetailPageProps = { params: Promise<{ id: string }> };

const adenaFormatter = new Intl.NumberFormat("ru-RU");

export default function RaidDetailPage({ params }: RaidDetailPageProps) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted/50" />}>
      <RaidDetailContent params={params} />
    </Suspense>
  );
}

async function RaidDetailContent({ params }: RaidDetailPageProps) {
  await io();
  const { id } = await params;
  const workspace = await ensureLocalWorkspace();

  let raid;
  try {
    raid = await getRaid(workspace.partyId, id);
  } catch (error) {
    if (error instanceof RaidNotFoundError) {
      notFound();
    }
    throw error;
  }

  return (
    <div className="space-y-7">
      <header>
        <Link href="/raids" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft aria-hidden="true" size={16} />
          К рейдам
        </Link>
        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-primary">{workspace.partyName}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{raid.name}</h1>
            {raid.instanceName && <p className="mt-1 text-muted-foreground">{raid.instanceName}</p>}
            <p className="mt-2 text-sm text-muted-foreground">
              <LocalDateTimeDisplay value={raid.occurredAt.toISOString()} />
            </p>
          </div>
          {raid.lockedAt ? (
            <Badge variant="outline">Финансовая история зафиксирована</Badge>
          ) : (
            <Link
              href={`/raids/${raid.id}/edit`}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
            >
              <Pencil aria-hidden="true" />
              Редактировать
            </Link>
          )}
        </div>
      </header>

      {raid.comment && (
        <Card>
          <CardHeader><CardTitle>Комментарий к рейду</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">{raid.comment}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Исторический состав</CardTitle>
          <CardDescription>Имена сохранены на момент проведения рейда.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2">
            {raid.participants.map((participant) => (
              <li key={participant.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                <span>{participant.nicknameSnapshot}</span>
                <Badge variant={participant.status === "PRESENT" ? "secondary" : "outline"}>
                  {participant.status === "PRESENT" ? "Присутствовал" : "Отсутствовал"}
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ScrollText aria-hidden="true" size={19} />
          </div>
          <CardTitle>Выпадения</CardTitle>
          <CardDescription>
            Каждая строка представляет отдельное получение предмета.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {raid.lootDrops.length === 0 ? (
            <div className="rounded-xl border border-dashed px-6 py-8 text-center">
              <p className="font-medium">Выпадений пока нет</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Добавьте записи через редактирование рейда.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {raid.lootDrops.map((drop) => (
                <li key={drop.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Link href={`/items/${drop.item.id}`} className="font-medium hover:text-primary">
                        {drop.item.displayName || drop.item.canonicalName}
                      </Link>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Оригинальное название: {drop.item.canonicalName}
                      </p>
                      {drop.comment && (
                        <p className="mt-2 text-sm text-muted-foreground">{drop.comment}</p>
                      )}
                    </div>
                    <Badge variant="outline">Количество: {drop.quantity}</Badge>
                  </div>
                  {drop.saleTransactions.length > 0 && (
                    <div className="mt-4 rounded-lg border px-3 py-3">
                      <p className="text-sm font-medium">Продажи и распределение</p>
                      <ul className="mt-2 divide-y divide-border">
                        {drop.saleTransactions.map((sale) => (
                          <li key={sale.id} className="py-3 first:pt-0 last:pb-0">
                            <div className="flex flex-wrap justify-between gap-2 text-sm">
                              <span>
                                {sale.quantitySold} шт. · {adenaFormatter.format(sale.totalPrice)} Adena
                              </span>
                              <LocalDateTimeDisplay value={sale.receivedAt.toISOString()} />
                            </div>
                            {sale.comment && (
                              <p className="mt-1 text-xs text-muted-foreground">{sale.comment}</p>
                            )}
                            <ul className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                              {sale.shares.map((share) => (
                                <li key={share.id} className="flex justify-between gap-3">
                                  <span>{share.nicknameSnapshot}</span>
                                  <span>{adenaFormatter.format(share.amount)} Adena</span>
                                </li>
                              ))}
                            </ul>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <SaleForm
                    lootDropId={drop.id}
                    remainingQuantity={
                      drop.quantity -
                      drop.saleTransactions.reduce((sum, sale) => sum + sale.quantitySold, 0)
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
