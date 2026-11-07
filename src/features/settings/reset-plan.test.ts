import { describe, expect, it } from "vitest";
import { resetCategorySchema, resetRequestSchema, resolveResetCategories } from "./reset-plan";
import { RESET_PARTY_CONFIRMATION } from "./reset-confirmation";

describe("selective reset dependencies", () => {
  it.each(
    Array.from({ length: 2 ** resetCategorySchema.options.length - 1 }, (_, index) => index + 1),
  )("closes every nonempty selection and is idempotent (mask %i)", (mask) => {
    const categories = resetCategorySchema.options.filter(
      (_, index) => (mask & (1 << index)) !== 0,
    );
    const resolved = resolveResetCategories(categories);
    expect(new Set(resolved).size).toBe(resolved.length);
    expect(categories.every((category) => resolved.includes(category))).toBe(true);
    expect(resolveResetCategories(resolved)).toEqual(resolved);
  });
  it("keeps unrelated sales when only payouts or saved compositions are selected", () => {
    expect(resolveResetCategories(["payments"])).toEqual(["payments"]);
    expect(resolveResetCategories(["compositions"])).toEqual(["compositions"]);
  });
  it("cannot delete loot without also clearing sales, shares and payouts", () => {
    expect(resolveResetCategories(["loot"])).toEqual(["loot", "sales", "payments"]);
    expect(resolveResetCategories(["sales"])).toEqual(["sales", "payments"]);
  });
  it("keeps the live roster when raids are selected; deleting roster requires all dependents", () => {
    expect(resolveResetCategories(["raids"])).toEqual(["raids", "loot", "sales", "payments"]);
    expect(resolveResetCategories(["members"])).toEqual([
      "raids",
      "loot",
      "sales",
      "payments",
      "compositions",
      "members",
    ]);
  });
  it("deduplicates overlapping selections", () => {
    expect(resolveResetCategories(["loot", "sales", "payments"])).toEqual(
      resolveResetCategories(["loot"]),
    );
  });
  it.each(
    [[], ["items"], ["catalog"], ["users"], ["loot", "catalog"]].map((categories) => ({
      categories,
    })),
  )("rejects an empty or unsupported request: $categories", ({ categories }) => {
    expect(
      resetRequestSchema.safeParse({ categories, confirmation: RESET_PARTY_CONFIRMATION }).success,
    ).toBe(false);
  });
  it("requires both explicit selection and the confirmation phrase", () => {
    expect(resetRequestSchema.safeParse({ confirmation: RESET_PARTY_CONFIRMATION }).success).toBe(
      false,
    );
    expect(
      resetRequestSchema.safeParse({ categories: ["raids"], confirmation: "delete" }).success,
    ).toBe(false);
  });
});
