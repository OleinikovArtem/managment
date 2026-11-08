"use client";
import { useMemo } from "react";
import { SearchSelect } from "@/components/ui/search-select";
export function MemberSelect({
  rows,
  value,
  onChange,
}: {
  rows: { id: string; nickname: string }[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const options = useMemo(
    () => rows.map((r) => ({ id: r.id, label: r.nickname, search: r.nickname })),
    [rows],
  );
  return (
    <SearchSelect
      rows={options}
      value={value}
      onChange={onChange}
      label="Фильтр персонажа"
      emptyLabel="Все персонажи"
    />
  );
}
