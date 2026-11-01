import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createPartyItemRecord,
  getPartyItemById,
  listPartyItemCategories,
  listPartyItems,
  updatePartyItemRecord,
} = vi.hoisted(() => ({
  createPartyItemRecord: vi.fn(),
  getPartyItemById: vi.fn(),
  listPartyItemCategories: vi.fn(),
  listPartyItems: vi.fn(),
  updatePartyItemRecord: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/repositories/item-repository", () => ({
  createPartyItemRecord,
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
  updateItem,
} from "@/server/services/item-service";

describe("item service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("computes normalizedName on the server and scopes creation by partyId", async () => {
    const input = {
      canonicalName: "  Ancient   Sword ",
      category: "Weapon",
    };

    await createItem("party-a", input);

    expect(createPartyItemRecord).toHaveBeenCalledWith(
      "party-a",
      input,
      "ancient sword",
    );
  });

  it("translates database unique conflicts into a domain error", async () => {
    createPartyItemRecord.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "7.10.1",
        meta: { target: ["partyId", "normalizedName"] },
      }),
    );

    await expect(
      createItem("party-a", { canonicalName: "Ancient Sword" }),
    ).rejects.toBeInstanceOf(DuplicateItemError);
  });

  it("normalizes search text before the party-scoped repository query", async () => {
    await searchItems("party-a", "  ANCIENT   SWORD ", "Weapon");

    expect(listPartyItems).toHaveBeenCalledWith(
      "party-a",
      "ancient sword",
      "Weapon",
    );
  });

  it("scopes item details by party and rejects IDs from another party", async () => {
    getPartyItemById.mockResolvedValue(null);

    await expect(getItem("party-a", "item-from-party-b")).rejects.toBeInstanceOf(
      ItemNotFoundError,
    );
    expect(getPartyItemById).toHaveBeenCalledWith(
      "party-a",
      "item-from-party-b",
    );
  });

  it("updates the existing party-scoped item instead of creating another", async () => {
    updatePartyItemRecord.mockResolvedValue({ id: "item-1" });

    await updateItem("party-a", "item-1", {
      canonicalName: "Updated Sword",
      category: "Weapon",
    });

    expect(updatePartyItemRecord).toHaveBeenCalledWith(
      "party-a",
      "item-1",
      { canonicalName: "Updated Sword", category: "Weapon" },
      "updated sword",
    );
    expect(createPartyItemRecord).not.toHaveBeenCalled();
  });
});
