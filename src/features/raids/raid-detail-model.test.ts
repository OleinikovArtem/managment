import { describe, expect, it } from "vitest";
import { getRaidLootFilterCounts, getRaidLootSummary } from "@/features/raids/raid-detail-model";

describe("raid detail loot summaries", () => {
  it("marks untouched, partially sold, and fully sold drops", () => {
    expect(getRaidLootSummary(3, [])).toEqual({
      soldQuantity: 0,
      remainingQuantity: 3,
      state: "unsold",
    });
    expect(getRaidLootSummary(4, [{ quantitySold: 1 }, { quantitySold: 1 }])).toEqual({
      soldQuantity: 2,
      remainingQuantity: 2,
      state: "partial",
    });
    expect(getRaidLootSummary(2, [{ quantitySold: 2 }])).toEqual({
      soldQuantity: 2,
      remainingQuantity: 0,
      state: "complete",
    });
  });

  it("counts partial drops in both remaining and sold filters", () => {
    expect(
      getRaidLootFilterCounts([
        { quantity: 2, sales: [] },
        { quantity: 3, sales: [{ quantitySold: 1 }] },
        { quantity: 1, sales: [{ quantitySold: 1 }] },
      ]),
    ).toEqual({ all: 3, remaining: 2, sold: 2 });
  });

  it("returns zero counts for an empty raid", () => {
    expect(getRaidLootFilterCounts([])).toEqual({ all: 0, remaining: 0, sold: 0 });
  });
});
