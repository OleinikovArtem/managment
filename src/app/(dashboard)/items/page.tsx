import { Suspense } from "react";
import { io } from "next/cache";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ItemManager,
  type ItemListRow,
} from "@/features/items/item-manager";
import { itemSearchSchema } from "@/features/items/item-schema";
import {
  getItemCategories,
  searchItems,
} from "@/server/services/item-service";
import { ensureLocalWorkspace } from "@/server/bootstrap/local-workspace";

type ItemsPageProps = {
  searchParams: Promise<{ q?: string; category?: string }>;
};

export default function ItemsPage({ searchParams }: ItemsPageProps) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted/50" />}>
      <ItemsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ItemsContent({ searchParams }: ItemsPageProps) {
  await io();
  const rawParams = await searchParams;
  const parsedParams = itemSearchSchema.safeParse({
    query: rawParams.q,
    category: rawParams.category,
  });
  const params = parsedParams.success
    ? parsedParams.data
    : { query: "", category: "" };
  const query = params.query ?? "";
  const category = params.category || undefined;
  const { partyId, partyName } = await ensureLocalWorkspace();

  const [records, categories] = await Promise.all([
    searchItems(partyId, query, category),
    getItemCategories(partyId),
  ]);
  const items: ItemListRow[] = records.map((item) => ({
    id: item.id,
    canonicalName: item.canonicalName,
    displayName: item.displayName ?? "",
    category: item.category ?? "",
    gameVersion: item.gameVersion ?? "",
    comment: item.comment ?? "",
    createdAt: item.createdAt.toLocaleDateString("ru-RU"),
  }));

  return (
    <div className="space-y-7">
      <header>
        <p className="text-sm font-medium text-primary">{partyName}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Каталог предметов</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Справочник уникальных предметов группы. Добыча и продажи хранятся отдельно как история.
        </p>
      </header>

      <form method="get" action="/items" className="flex flex-col gap-3 sm:flex-row">
        <Input
          name="q"
          defaultValue={query}
          maxLength={200}
          aria-label="Поиск по названию"
          placeholder="Поиск по оригинальному названию"
          className="h-10 sm:max-w-md"
        />
        <select
          name="category"
          defaultValue={category ?? ""}
          aria-label="Фильтр по категории"
          className="h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground sm:w-56"
        >
          <option value="">Все категории</option>
          {categories.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline" className="h-10">
          Найти
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">
        Найдено: {records.length}
      </p>
      <ItemManager items={items} />
    </div>
  );
}
