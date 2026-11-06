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

describe("shared item catalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("searches the shared catalog with category filters and pagination", async () => {
    await listPartyItems("party-a", "ancient sword", "Weapon", 25, 25);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          normalizedName: { contains: "ancient sword" },
          category: "Weapon",
        },
        skip: 25,
        take: 25,
      }),
    );
  });

  it("counts shared items matching the query and category", async () => {
    await countPartyItems("party-a", "ancient sword", "Weapon");

    expect(count).toHaveBeenCalledWith({
      where: {
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
          category: "Armor",
          grade: "S",
          itemType: "Boots",
          itemSubtype: "Light",
          isRare: true,
        }),
      }),
    );
    expect(create.mock.calls[0][0].data).not.toHaveProperty("partyId");
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

  it("lists category options from the shared catalog", async () => {
    findMany.mockResolvedValue([{ category: "Weapon" }]);

    await expect(listPartyItemCategories("party-a")).resolves.toEqual(["Weapon"]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { category: { not: null } },
      }),
    );
  });

  it("looks up shared items by item ID", async () => {
    await getPartyItemById("party-a", "item-b");

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "item-b" },
    });
  });
});
