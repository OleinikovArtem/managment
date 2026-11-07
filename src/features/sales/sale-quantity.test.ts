import { describe, expect, it } from "vitest";
import { clampSaleQuantity } from "@/features/sales/sale-quantity";

describe("clampSaleQuantity", () => {
  it("clamps manual input to the available stock", () => {
    expect(clampSaleQuantity("99", 4)).toBe("4");
  });

  it("keeps entered values within the positive integer range", () => {
    expect(clampSaleQuantity("0", 4)).toBe("1");
    expect(clampSaleQuantity("2.9", 4)).toBe("2");
    expect(clampSaleQuantity("3", 4)).toBe("3");
  });

  it("allows clearing the field while editing", () => {
    expect(clampSaleQuantity("", 4)).toBe("");
  });
});
