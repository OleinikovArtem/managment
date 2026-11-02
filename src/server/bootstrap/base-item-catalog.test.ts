import { beforeEach, describe, expect, it, vi } from "vitest";

import baseItemDump from "../../../prisma/seeds/lineage2-high-five-items.json";
import { normalizeItemName } from "@/features/items/item-schema";
import { ensureBaseItemCatalog } from "@/server/bootstrap/base-item-catalog";
import {
  classifyHighFiveItem,
  legacyHighFiveCategories,
} from "@/server/bootstrap/high-five-item-classification";

const findMany = vi.fn();
const upsert = vi.fn();

describe("High Five base item catalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps a unique, curated dump limited to requested categories", () => {
    const names = baseItemDump.items.map((item) =>
      normalizeItemName(item.canonicalName),
    );
    const categories = new Set(baseItemDump.items.map((item) => item.category));

    expect(new Set(names).size).toBe(names.length);
    expect(baseItemDump.gameVersion).toBe("High Five");
    expect(categories).toEqual(
      new Set(["Materials", "Armor", "Weapon", "Skill Book", "Enchant Scroll"]),
    );
  });

  it("classifies gear by group, grade, slot, armor type and rarity", () => {
    const findItem = (name: string) => {
      const item = baseItemDump.items.find(
        (entry) => entry.canonicalName === name,
      );
      if (!item) throw new Error(`Missing seed item: ${name}`);
      return classifyHighFiveItem(item);
    };

    expect(findItem("Angel Slayer")).toMatchObject({
      category: "Weapon",
      grade: "S",
      itemType: "Dagger",
      itemSubtype: null,
      isRare: false,
    });
    expect(findItem("Dynasty Boots")).toMatchObject({
      category: "Armor",
      grade: "S80",
      itemType: "Boots",
      itemSubtype: "Heavy",
    });
    expect(findItem("Draconic Leather Boots")).toMatchObject({
      category: "Armor",
      grade: "S",
      itemType: "Boots",
      itemSubtype: "Light",
    });
    expect(
      classifyHighFiveItem({
        canonicalName: "Rare Vesper Noble Boots",
        category: "Armor",
      }),
    ).toMatchObject({
      category: "Armor",
      grade: "S84",
      itemType: "Boots",
      itemSubtype: "Heavy",
      isRare: true,
    });

    for (const item of baseItemDump.items) {
      expect(() => classifyHighFiveItem(item)).not.toThrow();
    }
  });

  it("inserts missing names for only the requested Party and preserves existing catalog rows", async () => {
    const existing = ["Life Stone - Lv. 46", "Neolithic Crystal"].map((name) => {
      const item = baseItemDump.items.find(
        (entry) => entry.canonicalName === name,
      );
      if (!item) throw new Error(`Missing seed item: ${name}`);
      return {
        normalizedName: normalizeItemName(name),
        ...classifyHighFiveItem(item),
      };
    });
    findMany.mockResolvedValue(existing);
    const transaction = { item: { findMany, upsert } };

    await expect(
      ensureBaseItemCatalog(transaction, "party-1"),
    ).resolves.toBe(baseItemDump.items.length - 2);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          partyId: "party-1",
          normalizedName: {
            in: expect.arrayContaining([
              normalizeItemName("Life Stone - Lv. 46"),
              normalizeItemName("Neolithic Crystal"),
            ]),
          },
        },
      }),
    );
    expect(upsert).toHaveBeenCalledTimes(baseItemDump.items.length - 2);
    expect(upsert).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          partyId_normalizedName: {
            partyId: "party-1",
            normalizedName: normalizeItemName("Life Stone - Lv. 46"),
          },
        },
      }),
    );
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          partyId_normalizedName: expect.objectContaining({ partyId: "party-1" }),
        },
        update: expect.objectContaining({
          category: "Weapon",
          grade: "S",
          itemType: "Dagger",
        }),
        create: expect.objectContaining({
          partyId: "party-1",
          category: "Weapon",
          grade: "S",
          itemType: "Dagger",
          gameVersion: "High Five",
        }),
      }),
    );
  });

  it("migrates only legacy seed groups to structured classifications", async () => {
    findMany.mockResolvedValue(
      baseItemDump.items.map((item) => ({
        normalizedName: normalizeItemName(item.canonicalName),
        category: legacyHighFiveCategories[item.category]?.[0],
      })),
    );

    await expect(
      ensureBaseItemCatalog({ item: { findMany, upsert } }, "party-1"),
    ).resolves.toBe(0);

    expect(upsert).toHaveBeenCalledTimes(baseItemDump.items.length);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          partyId_normalizedName: {
            partyId: "party-1",
            normalizedName: normalizeItemName("Angel Slayer"),
          },
        },
        update: expect.objectContaining({
          category: "Weapon",
          grade: "S",
          itemType: "Dagger",
        }),
      }),
    );
  });

  it("does not write anything when all dump items already exist", async () => {
    findMany.mockResolvedValue(
      baseItemDump.items.map((item) => ({
        normalizedName: normalizeItemName(item.canonicalName),
        ...classifyHighFiveItem(item),
      })),
    );

    await expect(
      ensureBaseItemCatalog({ item: { findMany, upsert } }, "party-1"),
    ).resolves.toBe(0);
    expect(upsert).not.toHaveBeenCalled();
  });
});
