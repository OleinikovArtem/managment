import { describe, expect, it } from "vitest";
import { calculateWeightedShares } from "@/server/services/sale-distribution";

describe("calculateWeightedShares", () => {
  it("uses Largest Remainder Method and conserves every Adena", () => {
    const shares = calculateWeightedShares(101n, [
      { id: "member-a", weight: 2 },
      { id: "member-b", weight: 1 },
      { id: "member-c", weight: 1 },
    ]);

    expect(shares.map(({ amount }) => amount)).toEqual([51n, 25n, 25n]);
    expect(shares.reduce((sum, { amount }) => sum + amount, 0n)).toBe(101n);
  });

  it("breaks equal remainders by participant id independent of input order", () => {
    const shares = calculateWeightedShares(2n, [
      { id: "participant-b", weight: 1 },
      { id: "participant-a", weight: 1 },
      { id: "participant-c", weight: 1 },
    ]);

    expect(shares).toEqual([
      { participant: { id: "participant-a", weight: 1 }, amount: 1n },
      { participant: { id: "participant-b", weight: 1 }, amount: 1n },
      { participant: { id: "participant-c", weight: 1 }, amount: 0n },
    ]);
  });

  it("supports amounts above JavaScript's safe integer range", () => {
    const total = 9_007_199_254_740_999n;
    const shares = calculateWeightedShares(total, [
      { id: "a", weight: 1 },
      { id: "b", weight: 1 },
    ]);

    expect(shares.map(({ amount }) => amount)).toEqual([
      4_503_599_627_370_500n,
      4_503_599_627_370_499n,
    ]);
    expect(shares.reduce((sum, { amount }) => sum + amount, 0n)).toBe(total);
  });

  it("rejects missing participants, invalid weights and duplicate ids", () => {
    expect(() => calculateWeightedShares(10n, [])).toThrow();
    expect(() => calculateWeightedShares(10n, [{ id: "a", weight: 0 }])).toThrow();
    expect(() =>
      calculateWeightedShares(10n, [
        { id: "same", weight: 1 },
        { id: "same", weight: 2 },
      ]),
    ).toThrow();
  });
});
