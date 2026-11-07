import { describe, expect, it, vi } from "vitest";
import dump from "../../../prisma/seeds/lineage2-high-five-items.json";
import instanceLootDump from "../../../prisma/seeds/bohpts-stage-1-loot.json";
import { ensureBaseItemCatalog } from "./base-item-catalog";
import { classifyHighFiveItem } from "./high-five-item-classification";
import { normalizeItemName } from "@/features/items/item-schema";

describe("administrative shared item bootstrap", () => {
  it("keeps unique names and distinct item classifications", () => {
    expect(new Set(dump.items.map((item) => normalizeItemName(item.canonicalName))).size).toBe(
      dump.items.length,
    );
    for (const item of dump.items) expect(() => classifyHighFiveItem(item)).not.toThrow();
    expect(
      classifyHighFiveItem({ canonicalName: "Draconic Leather Boots", category: "Armor" }),
    ).toMatchObject({ grade: "S", itemType: "Boots", itemSubtype: "Light" });
    expect(
      classifyHighFiveItem({ canonicalName: "Rare Vesper Noble Boots", category: "Armor" }),
    ).toMatchObject({ grade: "S84", isRare: true });
    const supplied = Object.values(instanceLootDump.sources).flatMap((source) => source.items);
    for (const item of supplied)
      expect(() =>
        classifyHighFiveItem({ canonicalName: item.name, category: item.category }),
      ).not.toThrow();
    expect(instanceLootDump.sources.labyrinth.items).toHaveLength(30);
    expect(instanceLootDump.sources.fortress.items).toHaveLength(12);
  });
  it("only inserts missing global definitions without updating existing/custom catalog", async () => {
    const createMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 130 })
      .mockResolvedValueOnce({ count: 0 });
    const client = { item: { createMany } };
    expect(await ensureBaseItemCatalog(client)).toBe(130);
    expect(await ensureBaseItemCatalog(client)).toBe(0);
    expect(createMany).toHaveBeenCalledWith({
      skipDuplicates: true,
      data: expect.arrayContaining([
        expect.objectContaining({
          partyId: null,
          canonicalName: "Angel Slayer",
          normalizedName: "angel slayer",
          gameVersion: "High Five",
        }),
      ]),
    });
    expect(createMany).toHaveBeenCalledWith({
      skipDuplicates: true,
      data: expect.arrayContaining([
        expect.objectContaining({
          partyId: null,
          canonicalName: "Elysian",
          normalizedName: "elysian",
        }),
      ]),
    });
  });
});
