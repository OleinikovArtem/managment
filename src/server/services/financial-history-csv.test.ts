import { describe, expect, it } from "vitest";

import { createFinancialHistoryCsv } from "@/server/services/financial-history-csv";

describe("financial history CSV", () => {
  it("writes a UTF-8 BOM, CSV header and CRLF line endings for empty history", () => {
    const csv = createFinancialHistoryCsv([]);

    expect(csv.startsWith("\uFEFFТип записи,")).toBe(true);
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(csv.split("\r\n")).toHaveLength(2);
  });

  it("protects CSV fields from spreadsheet formulas and quotes CSV delimiters", () => {
    const csv = createFinancialHistoryCsv([
      {
        id: "txn-1",
        partyId: "party-1",
        type: "SALE_POSTED",
        status: "POSTED",
        saleTransactionId: "sale-1",
        memberPaymentId: null,
        postedAt: new Date("2026-11-02T10:00:00.000Z"),
        createdAt: new Date("2026-11-02T10:00:00.000Z"),
        entries: [],
        saleTransaction: {
          id: "sale-1",
          partyId: "party-1",
          raidId: "raid-1",
          lootDropId: "drop-1",
          idempotencyKey: "request-1",
          createdAt: new Date("2026-11-02T09:00:00.000Z"),
          receivedAt: new Date("2026-11-02T09:00:00.000Z"),
          comment: '=HYPERLINK("https://example.invalid","open"), reviewed',
          quantitySold: 1,
          totalPrice: 1250000n,
          distributionMethod: "WEIGHTED",
          algorithmVersion: 1,
          raid: { id: "raid-1", name: "Raid, Alpha" },
          lootDrop: {
            item: { canonicalName: "Adena", displayName: null },
          },
          shares: [
            {
              memberId: "member-1",
              nicknameSnapshot: "@=player",
              amount: 1250000n,
              weightSnapshot: 1,
              distributionMethod: "WEIGHTED",
              algorithmVersion: 1,
            },
          ],
        },
        memberPayment: null,
      },
    ]);

    expect(csv).toContain(
      `"'=HYPERLINK(""https://example.invalid"",""open""), reviewed"`,
    );
    expect(csv).toContain('"Raid, Alpha"');
    expect(csv).toContain("'@=player");
    expect(csv).toContain("1250000");
  });
});
