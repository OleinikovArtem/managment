import { describe, expect, it } from "vitest";

import { createFinancialHistoryCsv } from "@/server/services/financial-history-csv";

describe("financial history CSV", () => {
  it("writes a UTF-8 BOM, CSV header and CRLF line endings for empty history", () => {
    const csv = createFinancialHistoryCsv([]);

    expect(csv.startsWith("\uFEFFОперация,")).toBe(true);
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(csv.split("\r\n")).toHaveLength(2);
  });

  it("exports sale shares in plain language and protects spreadsheet fields", () => {
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
      {
        id: "txn-2",
        partyId: "party-1",
        type: "PAYOUT_POSTED",
        status: "POSTED",
        saleTransactionId: null,
        memberPaymentId: "payment-1",
        postedAt: new Date("2026-11-02T11:00:00.000Z"),
        createdAt: new Date("2026-11-02T11:00:00.000Z"),
        entries: [],
        saleTransaction: null,
        memberPayment: {
          id: "payment-1",
          partyId: "party-1",
          memberId: "member-1",
          nicknameSnapshot: "Player",
          amount: 500000n,
          paidAt: new Date("2026-11-02T10:30:00.000Z"),
          comment: null,
          idempotencyKey: "payment-request-1",
          createdAt: new Date("2026-11-02T10:30:00.000Z"),
          allocations: [],
        },
      },
    ]);

    expect(csv).toContain(`"'=HYPERLINK(""https://example.invalid"",""open""), reviewed"`);
    const [header, saleRow] = csv.slice(1).split("\r\n");
    expect(header).toContain("Доля с продажи Adena");
    expect(saleRow).toContain('"Raid, Alpha"');
    expect(saleRow).toContain("'@=player");
    expect(saleRow).toContain("1250000");
    expect(saleRow).toContain("Продажа");
    expect(csv).toContain("Передача участнику,2026-11-02T10:30:00.000Z,,,,500000,Player");
  });
});
