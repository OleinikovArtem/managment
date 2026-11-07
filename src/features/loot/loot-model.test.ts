import { describe, expect, it } from "vitest";
import {
  formatSalesTooltip,
  getAverageUnitPrice,
  getLootCards,
  groupLoot,
} from "@/features/loot/loot-model";
import type { LootRow } from "@/server/repositories/loot-repository";

function row(id: string, createdAt: string, sold: number, proceeds: string): LootRow {
  return {
    id,
    itemId: "same-item",
    canonicalName: "Same Item",
    displayName: null,
    category: "Weapon",
    raidId: `raid-${id}`,
    raidName: `Raid ${id}`,
    occurredAt: createdAt,
    createdAt,
    quantity: 2,
    sold,
    remaining: 2 - sold,
    proceeds,
    sales: sold > 0 ? [{ quantitySold: sold, totalPrice: proceeds, receivedAt: createdAt }] : [],
    name: "Same Item",
    status: sold === 0 ? "unsold" : sold === 2 ? "sold" : "partial",
  };
}

describe("groupLoot", () => {
  it("keeps one card per loot drop until combine is enabled", () => {
    const rows = [
      row("new", "2026-11-06T10:00:00.000Z", 0, "0"),
      row("old", "2026-11-01T10:00:00.000Z", 1, "9007199254740993"),
    ];

    expect(getLootCards(rows, false).map(({ drops }) => drops.map(({ id }) => id))).toEqual([
      ["new"],
      ["old"],
    ]);
    expect(getLootCards(rows, true)).toHaveLength(1);
  });

  it("groups by catalog item, sums quantities and money exactly, then orders lots FIFO", () => {
    const groups = groupLoot([
      row("new", "2026-11-06T10:00:00.000Z", 0, "0"),
      row("old", "2026-11-01T10:00:00.000Z", 1, "9007199254740993"),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      quantity: 4,
      sold: 1,
      remaining: 3,
      proceeds: "9007199254740993",
      status: "partial",
    });
    expect(groups[0].drops.map(({ id }) => id)).toEqual(["old", "new"]);
    expect(groups[0].drops.find(({ remaining }) => remaining > 0)?.id).toBe("old");
    expect(groups[0].sales).toHaveLength(1);
  });

  it("calculates average unit price using integer Adena and leaves unsold items empty", () => {
    expect(getAverageUnitPrice("1001", 2)).toBe(500n);
    expect(getAverageUnitPrice("1001", 0)).toBeNull();
  });

  it("lists each sale quantity with its unit price and exact received total", () => {
    const tooltip = formatSalesTooltip([
      { quantitySold: 5, totalPrice: "50000000", receivedAt: "2026-11-01T10:00:00.000Z" },
      { quantitySold: 2, totalPrice: "20000001", receivedAt: "2026-11-02T10:00:00.000Z" },
    ]);
    expect(tooltip.split("\n")).toEqual([
      `5 шт. · 10м/шт. · всего ${50_000_000n.toLocaleString("ru-RU")} Adena`,
      `2 шт. · ≈10м/шт. · всего ${20_000_001n.toLocaleString("ru-RU")} Adena`,
    ]);
  });

  it("marks a group sold only after every lot is exhausted", () => {
    expect(groupLoot([row("sold-a", "2026-11-01T10:00:00.000Z", 2, "10")])[0].status).toBe("sold");
    expect(groupLoot([row("open", "2026-11-01T10:00:00.000Z", 0, "0")])[0].status).toBe("unsold");
  });
});
