import type { getFinancialHistory } from "@/server/services/sale-service";

type FinancialHistory = Awaited<ReturnType<typeof getFinancialHistory>>;

const CSV_HEADERS = [
  "Операция",
  "Дата",
  "Предмет",
  "Рейд",
  "Количество",
  "Сумма Adena",
  "Участник",
  "Доля с продажи Adena",
  "Комментарий",
] as const;

function protectSpreadsheetFormula(value: string) {
  return /^[\s\uFEFF]*[=+\-@]/u.test(value) ? `'${value}` : value;
}

function escapeCsvCell(value: string) {
  const safeValue = protectSpreadsheetFormula(value);
  return /[",\r\n]/.test(safeValue)
    ? `"${safeValue.replaceAll('"', '""')}"`
    : safeValue;
}

function encodeCsvRow(values: readonly string[]) {
  return values.map(escapeCsvCell).join(",");
}

export function createFinancialHistoryCsv(
  transactions: FinancialHistory,
): string {
  const rows: string[][] = [];

  for (const transaction of transactions) {
    const sale = transaction.saleTransaction;
    const payment = transaction.memberPayment;
    if (!sale && !payment) {
      throw new Error(
        `Posted financial transaction ${transaction.id} has no sale or payment.`,
      );
    }

    if (sale) {
      const itemName =
        sale.lootDrop.item.displayName || sale.lootDrop.item.canonicalName;
      for (const share of sale.shares) {
        rows.push([
          "Продажа",
          sale.receivedAt.toISOString(),
          itemName,
          sale.raid.name,
          sale.quantitySold.toString(),
          sale.totalPrice.toString(),
          share.nicknameSnapshot,
          share.amount.toString(),
          sale.comment ?? "",
        ]);
      }
      continue;
    }

    if (payment) {
      rows.push([
        "Передача участнику",
        payment.paidAt.toISOString(),
        "",
        "",
        "",
        payment.amount.toString(),
        payment.nicknameSnapshot,
        "",
        payment.comment ?? "",
      ]);
    }
  }

  return `\uFEFF${[encodeCsvRow(CSV_HEADERS), ...rows.map(encodeCsvRow)].join("\r\n")}\r\n`;
}
