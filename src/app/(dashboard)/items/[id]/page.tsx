import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { io } from "next/cache";
import { ArrowLeft, ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ensureLocalWorkspace } from "@/server/bootstrap/local-workspace";
import { getItem, ItemNotFoundError } from "@/server/services/item-service";

type ItemDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ItemDetailPage({ params }: ItemDetailPageProps) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted/50" />}>
      <ItemDetailContent params={params} />
    </Suspense>
  );
}

async function ItemDetailContent({ params }: ItemDetailPageProps) {
  await io();
  const { id } = await params;
  const workspace = await ensureLocalWorkspace();

  let item;
  try {
    item = await getItem(workspace.partyId, id);
  } catch (error) {
    if (error instanceof ItemNotFoundError) {
      notFound();
    }
    throw error;
  }

  return (
    <div className="space-y-7">
      <header>
        <Link
          href="/items"
          className="inline-flex h-8 items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" />
          К каталогу
        </Link>
        <p className="mt-5 text-sm font-medium text-primary">{workspace.partyName}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {item.displayName || item.canonicalName}
        </h1>
        {item.displayName && (
          <p className="mt-2 text-sm text-muted-foreground">
            Оригинальное название: {item.canonicalName}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {item.category && <Badge variant="secondary">{item.category}</Badge>}
          {item.gameVersion && <Badge variant="outline">{item.gameVersion}</Badge>}
        </div>
      </header>

      {item.comment && (
        <Card>
          <CardHeader>
            <CardTitle>Комментарий</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {item.comment}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <span className="mb-2 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ScrollText aria-hidden="true" size={19} />
          </span>
          <CardTitle>История выпадений</CardTitle>
          <CardDescription>
            Записи о получении предмета привязываются отдельно к рейдам.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-dashed border-border px-6 py-8 text-center">
            <p className="font-medium">История пока не ведётся</p>
            <p className="mt-1 text-sm text-muted-foreground">
              История выпадений появится после реализации рейдов и LootDrop.
              Карточка каталога не хранит количество или даты получений.
            </p>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Добавлен {item.createdAt.toLocaleDateString("ru-RU")} · обновлён{" "}
        {item.updatedAt.toLocaleDateString("ru-RU")}
      </p>
    </div>
  );
}
