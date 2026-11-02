import { describe, expect, it } from "vitest";
import { saleInputSchema } from "@/features/sales/sale-schema";

const validInput = {
  lootDropId: "loot-drop-1",
  quantitySold: 1,
  totalPrice: "1250000",
  receivedAt: "2026-11-02T10:00:00.000Z",
  idempotencyKey: "b3f3c746-a6e6-41f0-9cb6-d018e7f2543e",
};

describe("saleInputSchema", () => {
  it("accepts a positive integer Adena amount represented as a decimal string", () => {
    expect(saleInputSchema.parse(validInput)).toEqual(validInput);
  });

  it.each(["0", "-1", "1.5", "1e6", "01", "9223372036854775808"])(
    "rejects invalid Adena amount %s",
    (totalPrice) => {
      expect(saleInputSchema.safeParse({ ...validInput, totalPrice }).success).toBe(false);
    },
  );

  it("accepts compact million notation", () => {
    expect(saleInputSchema.parse({ ...validInput, totalPrice: "5.25м" }).totalPrice).toBe("5250000");
  });

  it("rejects fractional and non-positive quantities", () => {
    expect(saleInputSchema.safeParse({ ...validInput, quantitySold: 0 }).success).toBe(false);
    expect(saleInputSchema.safeParse({ ...validInput, quantitySold: 1.5 }).success).toBe(false);
  });

  it("accepts an optional bounded sale comment", () => {
    expect(saleInputSchema.parse({ ...validInput, comment: "  Buyer  " }).comment).toBe(
      "Buyer",
    );
    expect(
      saleInputSchema.safeParse({ ...validInput, comment: "x".repeat(501) }).success,
    ).toBe(false);
  });

  it("rejects invalid idempotency keys and timestamps", () => {
    expect(saleInputSchema.safeParse({ ...validInput, idempotencyKey: "retry" }).success).toBe(false);
    expect(saleInputSchema.safeParse({ ...validInput, receivedAt: "tomorrow" }).success).toBe(false);
  });
});
