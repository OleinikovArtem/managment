import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { io } from "next/cache";
import { ArrowLeft } from "lucide-react";

import { LocalDateTimeDisplay } from "@/features/raids/local-date-time-display";
import { requirePartyPageAccess } from "@/server/auth/party-access";
import { getItem, ItemNotFoundError } from "@/server/services/item-service";
import { getItemLootHistory } from "@/server/services/raid-service";
import { GameIcon } from "@/components/ui/game-icon";

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
  const workspace = await requirePartyPageAccess();

  let item;
  try {
    item = await getItem(workspace.partyId, id);
  } catch (error) {
    if (error instanceof ItemNotFoundError) {
      notFound();
    }
    throw error;
  }
  const lootHistory = await getItemLootHistory(workspace.partyId, item.id);

  return (
    <div className="space-y-6">
      <Link
        href="/items"
        className="inline-flex min-h-10 items-center gap-2 text-sm text-muted-foreground"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Каталог предметов
      </Link>
      <header className="page-header">
        <div className="flex items-center gap-3">
          <GameIcon
            kind="item"
            name={item.displayName || item.canonicalName}
            category={item.category}
            size="lg"
          />
          <h1>{item.displayName || item.canonicalName}</h1>
        </div>
        {item.displayName && item.displayName !== item.canonicalName && (
          <p className="mt-2">{item.canonicalName}</p>
        )}
      </header>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-4 border-y border-border py-5 text-sm sm:grid-cols-3">
        {[
          ["Категория", item.category],
          ["Ранг", item.grade],
          ["Тип", item.itemType],
          ["Вариант", item.itemSubtype],
          ["Редкость", item.isRare ? "Rare" : "Обычный"],
          ["Версия", item.gameVersion],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1">{value || "—"}</dd>
          </div>
        ))}
      </dl>
      {item.comment && (
        <section>
          <h2 className="section-heading">Заметка</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.comment}</p>
        </section>
      )}
      <section>
        <h2 className="section-heading mb-4">История поступлений</h2>
        {lootHistory.length === 0 ? (
          <p className="empty-state">Этот предмет ещё не выпадал в рейдах группы.</p>
        ) : (
          <ul className="data-list">
            {lootHistory.map((drop) => (
              <li key={drop.id}>
                <div className="list-row">
                  <div>
                    <Link
                      href={`/raids/${drop.raid.id}`}
                      className="text-sm font-medium hover:underline underline-offset-4"
                    >
                      {drop.raid.name}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">
                      <LocalDateTimeDisplay value={drop.raid.occurredAt.toISOString()} />
                      {drop.raid.instanceName ? ` · ${drop.raid.instanceName}` : ""}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm tabular-nums">{drop.quantity} шт.</p>
                </div>
                {drop.comment && (
                  <p className="mt-2 text-sm text-muted-foreground">{drop.comment}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="text-xs text-muted-foreground">
        Добавлен {item.createdAt.toLocaleDateString("ru-RU")} · обновлён{" "}
        {item.updatedAt.toLocaleDateString("ru-RU")}
      </p>
    </div>
  );
}
