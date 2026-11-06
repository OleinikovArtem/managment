import { describe, expect, it } from "vitest";
import { allocateTelegramRow, parseTelegramSale, TELEGRAM_SALE_EXAMPLE } from "./sale-parser";

describe("Telegram sale parser", () => {
  it("translates the screenshot and ignores current balance", () => {
    expect(parseTelegramSale(TELEGRAM_SALE_EXAMPLE)).toEqual([{ name: "Giant's Codex", quantity: 4, proceeds: 168888888n }]);
  });
  it("handles multiple rows with explicit unit and row prices", () => {
    expect(parseTelegramSale("Sale completed\nSword x2 @ 100 Adena each\nShield x3 = 75 Adena\nSum: 275 Adena")).toEqual([
      { name: "Sword", quantity: 2, proceeds: 200n }, { name: "Shield", quantity: 3, proceeds: 75n },
    ]);
  });
  it("recognizes a buyer purchasing the player's listed item", () => {
    expect(parseTelegramSale("Your item has been purchased!\nItem: Sword\nQuantity: 1\nPrice: 100 Adena")).toEqual([{ name: "Sword", quantity: 1, proceeds: 100n }]);
  });
  it("ignores unrelated messages and purchases", () => {
    expect(parseTelegramSale("Current Adena: 50")).toBeNull();
    expect(parseTelegramSale("Purchase successful\nItem: Sword\nQuantity: 1\nPrice: 50")).toBeNull();
  });
  it.each([
    TELEGRAM_SALE_EXAMPLE.replace("168,888,888", "168,888,889"),
    TELEGRAM_SALE_EXAMPLE.replace("Quantity: 4", "Quantity: 0"),
    TELEGRAM_SALE_EXAMPLE.replace("42,222,222", "42.22"),
    TELEGRAM_SALE_EXAMPLE.replace("42,222,222", "9,223,372,036,854,775,807"),
    TELEGRAM_SALE_EXAMPLE + "\nUnknown item x5",
    "Successful sale\nSword x2 — 100 Adena",
  ])("rejects malformed or ambiguous amounts without losing a row", text => {
    expect(() => parseTelegramSale(text)).toThrow();
  });
});

describe("Telegram loot allocation", () => {
  const candidate = (id: string, day: number, quantity: number, sold = 0) => ({ id, itemId: "item", raidId: id, raidName: id, quantity, sold, occurredAt: new Date(2026, 0, day), createdAt: new Date(2026, 0, day) });
  it("allocates oldest first, deducts manual sales, preserves exact BigInt totals", () => {
    const rows = allocateTelegramRow({ name: "Sword", quantity: 4, proceeds: 9007199254740995n }, [candidate("new", 2, 4), candidate("old", 1, 3, 1)]);
    expect(rows.map(r => [r.lootDropId, r.quantity])).toEqual([["old", 2], ["new", 2]]);
    expect(rows.reduce((n, r) => n + BigInt(r.amount), 0n)).toBe(9007199254740995n);
  });
  it("fails rather than partially importing an oversale", () => {
    expect(() => allocateTelegramRow({ name: "Sword", quantity: 4, proceeds: 100n }, [candidate("old", 1, 3, 1)])).toThrow("не хватает 2");
  });
});
