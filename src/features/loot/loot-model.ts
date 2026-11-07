import type { LootRow } from "@/server/repositories/loot-repository";
import { formatAdena } from "@/lib/adena";

export type LootGroup = Omit<LootRow, "quantity" | "sold" | "remaining" | "proceeds" | "status"> & {
  drops: LootRow[];
  quantity: number;
  sold: number;
  remaining: number;
  proceeds: string;
  status: LootRow["status"];
  latestCreatedAt: string;
};

export function getLootCards(rows: LootRow[], combine: boolean): LootGroup[] {
  if (combine) return groupLoot(rows);
  return rows.map((row) => ({ ...row, drops: [row], latestCreatedAt: row.createdAt }));
}

export function groupLoot(rows: LootRow[]): LootGroup[] {
  const groups = new Map<string, LootGroup>();
  for (const row of rows) {
    const group = groups.get(row.itemId);
    if (group) {
      group.drops.push(row);
      group.quantity += row.quantity;
      group.sold += row.sold;
      group.remaining += row.remaining;
      group.proceeds = (BigInt(group.proceeds) + BigInt(row.proceeds)).toString();
      group.sales.push(...row.sales);
      if (row.createdAt > group.latestCreatedAt) group.latestCreatedAt = row.createdAt;
    } else {
      groups.set(row.itemId, { ...row, drops: [row], latestCreatedAt: row.createdAt });
    }
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      drops: group.drops.toSorted((left, right) => left.createdAt.localeCompare(right.createdAt)),
      sales: group.sales.toSorted((left, right) => left.receivedAt.localeCompare(right.receivedAt)),
      status: (group.remaining === 0
        ? "sold"
        : group.sold > 0
          ? "partial"
          : "unsold") as LootRow["status"],
    }))
    .toSorted((left, right) => right.latestCreatedAt.localeCompare(left.latestCreatedAt));
}

export function getAverageUnitPrice(proceeds: string, quantitySold: number): bigint | null {
  if (quantitySold <= 0) return null;
  return BigInt(proceeds) / BigInt(quantitySold);
}

export function formatSalesTooltip(sales: LootRow["sales"]): string {
  return sales
    .map(({ quantitySold, totalPrice }) => {
      const amount = BigInt(totalPrice);
      const quantity = BigInt(quantitySold);
      const unitPrice = amount / quantity;
      const approximate = amount % quantity !== 0n;
      return `${quantitySold} шт. · ${approximate ? "≈" : ""}${formatAdena(unitPrice)}/шт. · всего ${amount.toLocaleString("ru-RU")} Adena`;
    })
    .join("\n");
}
