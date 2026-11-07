import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createPartyItemRecord,
  countPartyItems,
  getPartyItemById,
  listPartyItemCategories,
  listPartyItems,
  updatePartyItemRecord,
} = vi.hoisted(() => ({
  createPartyItemRecord: vi.fn(),
  countPartyItems: vi.fn(),
  getPartyItemById: vi.fn(),
  listPartyItemCategories: vi.fn(),
  listPartyItems: vi.fn(),
  updatePartyItemRecord: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/repositories/item-repository", () => ({
  createPartyItemRecord,
  countPartyItems,
  getPartyItemById,
  listPartyItemCategories,
  listPartyItems,
  updatePartyItemRecord,
}));

import { Prisma } from "@/generated/prisma/client";
import {
  createItem,
  DuplicateItemError,
  getItem,
  ItemNotFoundError,
  searchItems,
  UnsupportedItemGradeError,
  updateItem,
} from "@/server/services/item-service";

describe("item service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    countPartyItems.mockResolvedValue(0);
  });

  it("computes normalizedName on the server and scopes creation by partyId", async () => {
    const input = {
      canonicalName: "  Ancient   Sword ",
      category: "Weapon",
    };

    await createItem("party-a", input);

    expect(createPartyItemRecord).toHaveBeenCalledWith("party-a", input, "ancient sword");
  });

  it("translates database unique conflicts into a domain error", async () => {
    createPartyItemRecord.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "7.10.1",
        meta: { target: ["partyId", "normalizedName"] },
      }),
    );

    await expect(createItem("party-a", { canonicalName: "Ancient Sword" })).rejects.toBeInstanceOf(
      DuplicateItemError,
    );
  });

  it("normalizes search text before the party-scoped repository query", async () => {
    await searchItems("party-a", "  ANCIENT   SWORD ", "Weapon");

    expect(listPartyItems).toHaveBeenCalledWith("party-a", "ancient sword", "Weapon", 0, 25);
  });

  it("returns a party-scoped page and clamps requests past the last page", async () => {
    countPartyItems.mockResolvedValue(51);
    listPartyItems.mockResolvedValue([{ id: "last-item" }]);

    await expect(searchItems("party-a", "", undefined, 99)).resolves.toEqual({
      items: [{ id: "last-item" }],
      total: 51,
      page: 3,
      pageCount: 3,
    });
    expect(countPartyItems).toHaveBeenCalledWith("party-a", "", undefined);
    expect(listPartyItems).toHaveBeenCalledWith("party-a", "", undefined, 50, 25);
  });

  it("scopes item details by party and rejects IDs from another party", async () => {
    getPartyItemById.mockResolvedValue(null);

    await expect(getItem("party-a", "item-from-party-b")).rejects.toBeInstanceOf(ItemNotFoundError);
    expect(getPartyItemById).toHaveBeenCalledWith("party-a", "item-from-party-b");
  });

  it("updates the existing party-scoped item instead of creating another", async () => {
    updatePartyItemRecord.mockResolvedValue({ id: "item-1" });
    getPartyItemById.mockResolvedValue({ id: "item-1", grade: "S" });

    await updateItem("party-a", "item-1", {
      canonicalName: "Updated Sword",
      category: "Weapon",
      grade: "S",
    });

    expect(updatePartyItemRecord).toHaveBeenCalledWith(
      "party-a",
      "item-1",
      { canonicalName: "Updated Sword", category: "Weapon", grade: "S" },
      "updated sword",
      "S",
    );
    expect(createPartyItemRecord).not.toHaveBeenCalled();
  });

  it("allows an unchanged legacy grade but rejects a newly submitted unsupported grade", async () => {
    getPartyItemById.mockResolvedValue({ id: "item-1", grade: "S85" });
    updatePartyItemRecord.mockResolvedValue({ id: "item-1" });
    await expect(
      updateItem("party-a", "item-1", { canonicalName: "Boots", grade: "S85" }),
    ).resolves.toBeTruthy();
    await expect(
      updateItem("party-a", "item-1", { canonicalName: "Boots", grade: "S86" }),
    ).rejects.toBeInstanceOf(UnsupportedItemGradeError);
  });

  it("rejects unsupported grades on create", async () => {
    await expect(
      createItem("party-a", { canonicalName: "Boots", grade: "S85" }),
    ).rejects.toBeInstanceOf(UnsupportedItemGradeError);
    expect(createPartyItemRecord).not.toHaveBeenCalled();
  });
});
