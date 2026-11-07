import { Suspense } from "react";
import { io } from "next/cache";
import Link from "next/link";
import { ItemSearchControls } from "@/features/items/item-search-controls";
import { ItemManager, type ItemListRow } from "@/features/items/item-manager";
import { itemSearchSchema } from "@/features/items/item-schema";
import { GridRowsSkeleton } from "@/components/ui/page-skeleton";
import { ITEM_PAGE_SIZE, getItemCategories, searchItems } from "@/server/services/item-service";
import { requirePartyPageAccess } from "@/server/auth/party-access";

type ItemsPageProps = {
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
};

export default function ItemsPage({ searchParams }: ItemsPageProps) {
  return (
    <div className="space-y-7">
      <header className="page-header">
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Предметы</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Общий справочник и собственные предметы группы. Общие записи доступны только для чтения.
        </p>
      </header>
      <Suspense fallback={<GridRowsSkeleton label="Загружается каталог предметов" rows={8} />}>
        <ItemsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ItemsContent({ searchParams }: ItemsPageProps) {
  await io();
  const rawParams = await searchParams;
  const parsedParams = itemSearchSchema.safeParse({
    query: rawParams.q,
    category: rawParams.category,
    page: rawParams.page,
  });
  const params = parsedParams.success ? parsedParams.data : { query: "", category: "", page: 1 };
  const query = params.query ?? "";
  const category = params.category || undefined;
  const workspace = await requirePartyPageAccess();
  const { partyId } = workspace;

  const [records, categories] = await Promise.all([
    searchItems(partyId, query, category, params.page),
    getItemCategories(partyId),
  ]);
  const items: ItemListRow[] = records.items.map((item) => ({
    id: item.id,
    partyId: item.partyId,
    isActive: item.isActive,
    canonicalName: item.canonicalName,
    displayName: item.displayName ?? "",
    category: item.category ?? "",
    grade: item.grade ?? "",
    itemType: item.itemType ?? "",
    itemSubtype: item.itemSubtype ?? "",
    isRare: item.isRare,
    gameVersion: item.gameVersion ?? "",
    comment: item.comment ?? "",
    createdAt: item.createdAt.toLocaleDateString("ru-RU"),
  }));

  return (
    <div>
      <ItemSearchControls query={query} category={category ?? ""} categories={categories} />

      <ItemManager
        items={items}
        canManage={workspace.canManage}
        summary={
          records.total === 0
            ? "Найдено: 0"
            : `Показано ${(records.page - 1) * ITEM_PAGE_SIZE + 1}–${Math.min(
                records.page * ITEM_PAGE_SIZE,
                records.total,
              )} из ${records.total}`
        }
      />
      {records.total > ITEM_PAGE_SIZE && (
        <nav
          aria-label="Страницы каталога предметов"
          className="flex flex-wrap items-center justify-center gap-3"
        >
          {records.page > 1 ? (
            <PageLink query={query} category={category} page={records.page - 1} label="Назад" />
          ) : (
            <span className="text-sm text-muted-foreground">Назад</span>
          )}
          <span className="text-sm text-muted-foreground">
            Страница {records.page} из {records.pageCount}
          </span>
          {records.page < records.pageCount ? (
            <PageLink query={query} category={category} page={records.page + 1} label="Вперёд" />
          ) : (
            <span className="text-sm text-muted-foreground">Вперёд</span>
          )}
        </nav>
      )}
    </div>
  );
}

function PageLink({
  query,
  category,
  page,
  label,
}: {
  query: string;
  category?: string;
  page: number;
  label: string;
}) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (category) params.set("category", category);
  params.set("page", String(page));

  return (
    <Link
      href={`/items?${params.toString()}`}
      prefetch={false}
      className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium transition-colors hover:bg-muted"
    >
      {label}
    </Link>
  );
}
