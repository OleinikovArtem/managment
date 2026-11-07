import { describe, expect, it } from "vitest";
import { paymentInputSchema } from "@/features/sales/payment-schema";

const validInput = {
  memberId: "member-1",
  amount: "250000",
  paidAt: "2026-11-02T10:00:00.000Z",
  idempotencyKey: "b3f3c746-a6e6-41f0-9cb6-d018e7f2543e",
};

describe("paymentInputSchema", () => {
  it("accepts a positive Adena amount as a decimal string", () => {
    expect(paymentInputSchema.parse(validInput)).toEqual(validInput);
  });

  it.each(["0", "-1", "1.5", "1e5", "01", "9223372036854775808"])(
    "rejects invalid Adena amount %s",
    (amount) => {
      expect(paymentInputSchema.safeParse({ ...validInput, amount }).success).toBe(false);
    },
  );

  it("accepts compact million notation", () => {
    expect(paymentInputSchema.parse({ ...validInput, amount: "5.25м" }).amount).toBe("5250000");
  });

  it("rejects malformed dates, IDs and overlong comments", () => {
    expect(paymentInputSchema.safeParse({ ...validInput, paidAt: "yesterday" }).success).toBe(
      false,
    );
    expect(paymentInputSchema.safeParse({ ...validInput, memberId: "" }).success).toBe(false);
    expect(paymentInputSchema.safeParse({ ...validInput, comment: "x".repeat(501) }).success).toBe(
      false,
    );
  });
});
