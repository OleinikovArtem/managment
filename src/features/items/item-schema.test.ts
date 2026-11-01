import { describe, expect, it } from "vitest";
import { itemInputSchema, normalizeItemName } from "@/features/items/item-schema";

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
});
