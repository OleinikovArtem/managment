import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany, findFirst } = vi.hoisted(() => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    item: {
      findMany,
      findFirst,
    },
  },
}));

import {
  getPartyItemById,
  listPartyItemCategories,
  listPartyItems,
} from "@/server/repositories/item-repository";

describe("item repository party scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scopes item searches and category filters to the requested party", async () => {
    await listPartyItems("party-a", "ancient sword", "Weapon");

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          partyId: "party-a",
          normalizedName: { contains: "ancient sword" },
          category: "Weapon",
        },
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
