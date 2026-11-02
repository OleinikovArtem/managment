import { beforeEach, describe, expect, it, vi } from "vitest";

import baseItemDump from "../../../prisma/seeds/lineage2-high-five-items.json";
import { normalizeItemName } from "@/features/items/item-schema";
import { ensureBaseItemCatalog } from "@/server/bootstrap/base-item-catalog";

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
      new Set([
        "Life Stones",
        "Neolithics",
        "S+ Armor",
        "Best A+ Weapons",
        "Skill Books",
        "Enchant Scrolls",
      ]),
    );
  });

  it("inserts missing names for only the requested Party and preserves existing catalog rows", async () => {
    findMany.mockResolvedValue([
      { normalizedName: normalizeItemName("Life Stone - Lv. 46") },
      { normalizedName: normalizeItemName("Neolithic Crystal") },
    ]);
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
        update: {},
        create: expect.objectContaining({
          partyId: "party-1",
          gameVersion: "High Five",
        }),
      }),
    );
  });

  it("does not write anything when all dump items already exist", async () => {
    findMany.mockResolvedValue(
      baseItemDump.items.map((item) => ({
        normalizedName: normalizeItemName(item.canonicalName),
      })),
    );

    await expect(
      ensureBaseItemCatalog({ item: { findMany, upsert } }, "party-1"),
    ).resolves.toBe(0);
    expect(upsert).not.toHaveBeenCalled();
  });
});
