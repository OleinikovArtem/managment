import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany, findFirst, count, create, updateMany } = vi.hoisted(() => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    item: {
      findMany,
      findFirst,
      count,
      create,
      updateMany,
    },
  },
}));

import {
  countPartyItems,
  createPartyItemRecord,
  getPartyItemById,
  listPartyItemCategories,
  listPartyItems,
} from "@/server/repositories/item-repository";

describe("item repository party scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scopes item searches and category filters to the requested party", async () => {
    await listPartyItems("party-a", "ancient sword", "Weapon", 25, 25);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          partyId: "party-a",
          normalizedName: { contains: "ancient sword" },
          category: "Weapon",
        },
        skip: 25,
        take: 25,
      }),
    );
  });

  it("counts only rows matching the requested Party, query and category", async () => {
    await countPartyItems("party-a", "ancient sword", "Weapon");

    expect(count).toHaveBeenCalledWith({
      where: {
        partyId: "party-a",
        normalizedName: { contains: "ancient sword" },
        category: "Weapon",
      },
    });
  });

  it("persists the structured classification and Rare status", async () => {
    await createPartyItemRecord(
      "party-a",
      {
        canonicalName: "Draconic Leather Boots",
        category: "Armor",
        grade: "S",
        itemType: "Boots",
        itemSubtype: "Light",
        isRare: true,
      },
      "draconic leather boots",
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          partyId: "party-a",
          category: "Armor",
          grade: "S",
          itemType: "Boots",
          itemSubtype: "Light",
          isRare: true,
        }),
      }),
    );
  });

  it("defaults omitted Rare status to false", async () => {
    await createPartyItemRecord(
      "party-a",
      { canonicalName: "Ancient Sword" },
      "ancient sword",
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isRare: false }),
      }),
    );
  });

  it("scopes category options to the requested party", async () => {
    findMany.mockResolvedValue([{ category: "Weapon" }]);

    await expect(listPartyItemCategories("party-a")).resolves.toEqual(["Weapon"]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { partyId: "party-a", category: { not: null } },
      }),
    );
  });

  it("scopes item detail lookups by both party and item ID", async () => {
    await getPartyItemById("party-a", "item-b");

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "item-b", partyId: "party-a" },
    });
  });
});
