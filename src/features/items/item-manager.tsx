"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowUpRight, Pencil, ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ItemForm } from "@/features/items/item-form";
import type { ItemInput } from "@/features/items/item-schema";
import { createItemAction, updateItemAction } from "@/app/(dashboard)/items/actions";

export type ItemListRow = ItemInput & {
  id: string;
  createdAt: string;
};

export function ItemManager({ items }: { items: ItemListRow[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);

  function handleCreate(itemId?: string) {
    router.refresh();
    if (itemId) {
      router.push(`/items/${itemId}`);
    }
  }

  function handleUpdate() {
    setEditingId(null);
    router.refresh();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Каталог предметов</CardTitle>
          <CardDescription>
            Справочник уникальных предметов. Каждое выпадение будет отдельной записью истории.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center">
              <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ScrollText aria-hidden="true" size={20} />
              </span>
              <h2 className="mt-4 font-medium">Предметы не найдены</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Измените условия поиска или добавьте предмет в каталог.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li key={item.id} className="py-4 first:pt-0 last:pb-0">
                  {editingId === item.id ? (
                    <ItemForm
                      initialValues={{
                        canonicalName: item.canonicalName,
                        displayName: item.displayName ?? "",
                        category: item.category ?? "",
                        grade: item.grade ?? "",
                        itemType: item.itemType ?? "",
                        itemSubtype: item.itemSubtype ?? "",
                        isRare: item.isRare,
                        gameVersion: item.gameVersion ?? "",
                        comment: item.comment ?? "",
                      }}
                      submitLabel="Сохранить предмет"
                      action={(values) => updateItemAction(item.id, values)}
                      onSuccess={handleUpdate}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <Link
                          href={`/items/${item.id}`}
                          className="font-medium hover:text-primary"
                        >
                          {item.displayName || item.canonicalName}
                        </Link>
                        {item.displayName && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Оригинальное название: {item.canonicalName}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.category && (
                            <Badge variant="secondary">{item.category}</Badge>
                          )}
                          {item.grade && (
                            <Badge variant="secondary">{item.grade}</Badge>
                          )}
                          {item.itemType && (
                            <Badge variant="secondary">{item.itemType}</Badge>
                          )}
                          {item.itemSubtype && (
                            <Badge variant="secondary">{item.itemSubtype}</Badge>
                          )}
                          {item.isRare && (
                            <Badge variant="destructive">Rare</Badge>
                          )}
                          {item.gameVersion && (
                            <Badge variant="outline">{item.gameVersion}</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingId(item.id)}
                        >
                          <Pencil aria-hidden="true" />
                          Изменить
                        </Button>
                        <Link
                          href={`/items/${item.id}`}
                          aria-label={`Подробнее: ${item.displayName || item.canonicalName}`}
                          className="inline-flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <ArrowUpRight aria-hidden="true" size={16} />
                        </Link>
                      </div>
                    </div>
                  )}
                  {item.comment && editingId !== item.id && (
                    <p className="mt-2 text-sm text-muted-foreground">{item.comment}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Добавить предмет</CardTitle>
          <CardDescription>
            Сохраните предмет один раз в справочнике. Он сможет иметь множество записей выпадения.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ItemForm
            submitLabel="Добавить в каталог"
            action={createItemAction}
            onSuccess={handleCreate}
          />
        </CardContent>
      </Card>
    </div>
  );
}
