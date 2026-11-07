export type RaidLootSaleQuantity = { quantitySold: number };
export type RaidLootState = "unsold" | "partial" | "complete";
export type RaidLootFilterCounts = {
  all: number;
  remaining: number;
  sold: number;
};

export function getRaidLootSummary(quantity: number, sales: readonly RaidLootSaleQuantity[]) {
  const soldQuantity = sales.reduce((total, sale) => total + sale.quantitySold, 0);
  const remainingQuantity = quantity - soldQuantity;
  const state: RaidLootState =
    remainingQuantity <= 0 ? "complete" : soldQuantity > 0 ? "partial" : "unsold";

  return { soldQuantity, remainingQuantity, state };
}

export function getRaidLootFilterCounts(
  drops: readonly { quantity: number; sales: readonly RaidLootSaleQuantity[] }[],
): RaidLootFilterCounts {
  let remaining = 0;
  let sold = 0;

  for (const drop of drops) {
    const summary = getRaidLootSummary(drop.quantity, drop.sales);
    if (summary.remainingQuantity > 0) remaining += 1;
    if (summary.soldQuantity > 0) sold += 1;
  }

  return { all: drops.length, remaining, sold };
}
