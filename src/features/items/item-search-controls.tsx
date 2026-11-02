"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";

type ItemSearchControlsProps = {
  query: string;
  category: string;
  categories: string[];
};

export function ItemSearchControls({
  query: initialQuery,
  category: initialCategory,
  categories,
}: ItemSearchControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.get("q") ?? "";
  const currentCategory = searchParams.get("category") ?? "";
  const search = searchParams.toString();
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);

  useEffect(() => {
    if (query === currentQuery && category === currentCategory) return;

    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(search);
      if (query.trim()) {
        params.set("q", query);
      } else {
        params.delete("q");
      }
      if (category) {
        params.set("category", category);
      } else {
        params.delete("category");
      }
      params.delete("page");
      const queryString = params.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
        scroll: false,
      });
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [category, currentCategory, currentQuery, pathname, query, router, search]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Input
        name="q"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        maxLength={200}
        aria-label="Поиск по названию"
        placeholder="Поиск по оригинальному названию"
        className="h-10 sm:max-w-md"
      />
      <select
        name="category"
        value={category}
        onChange={(event) => setCategory(event.target.value)}
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
    </div>
  );
}
