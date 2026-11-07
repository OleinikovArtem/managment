import { describe, expect, it } from "vitest";
import { itemInputSchema, itemSearchSchema, normalizeItemName } from "@/features/items/item-schema";

describe("normalizeItemName", () => {
  it("normalizes Unicode, case and whitespace", () => {
    expect(normalizeItemName("  ДРЕВНИЙ   МЕЧ\t")).toBe("древний меч");
    expect(normalizeItemName("Cafe\u0301")).toBe("café");
  });

  it("returns an empty key for whitespace-only input", () => {
    expect(normalizeItemName(" \t\n ")).toBe("");
  });
});

describe("itemInputSchema", () => {
  it("rejects normalizedName supplied by the client", () => {
    const result = itemInputSchema.safeParse({
      canonicalName: "Sword",
      normalizedName: "forged-value",
    });
    expect(result.success).toBe(false);
  });

  it("rejects names whose normalized value is empty", () => {
    const result = itemInputSchema.safeParse({ canonicalName: " \t " });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.canonicalName).toContain(
        "Название не может состоять только из пробелов.",
      );
    }
  });

  it("preserves the original canonical name", () => {
    const result = itemInputSchema.parse({ canonicalName: "  Hero Sword  " });

    expect(result.canonicalName).toBe("  Hero Sword  ");
  });

  it("accepts independent catalog classification fields and rarity", () => {
    expect(
      itemInputSchema.parse({
        canonicalName: "Draconic Leather Boots",
        category: "Armor",
        grade: "S",
        itemType: "Boots",
        itemSubtype: "Light",
        isRare: true,
      }),
    ).toMatchObject({
      category: "Armor",
      grade: "S",
      itemType: "Boots",
      itemSubtype: "Light",
      isRare: true,
    });
  });
});

describe("itemSearchSchema", () => {
  it("parses a positive page number from URL search params", () => {
    expect(itemSearchSchema.parse({ page: "3" }).page).toBe(3);
  });

  it("rejects invalid page numbers", () => {
    expect(itemSearchSchema.safeParse({ page: "0" }).success).toBe(false);
    expect(itemSearchSchema.safeParse({ page: "invalid" }).success).toBe(false);
  });
});
