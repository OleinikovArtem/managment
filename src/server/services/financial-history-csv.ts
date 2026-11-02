import type { getFinancialHistory } from "@/server/services/sale-service";

type FinancialHistory = Awaited<ReturnType<typeof getFinancialHistory>>;

const CSV_HEADERS = [
  "Тип записи",
  "ID операции",
  "Тип операции",
  "Время проведения (UTC)",
  "Тип источника",
  "ID источника",
  "Дата операции (UTC)",
  "Комментарий",
  "Предмет",
  "Рейд",
  "Количество",
  "Сумма операции (Adena)",
  "Сумма доли (Adena)",
  "ID участника",
  "Персонаж (снимок)",
  "Вес",
  "Метод распределения",
  "Версия алгоритма",
  "Счёт",
  "Дебет (Adena)",
  "Кредит (Adena)",
  "ID исходной продажи",
  "Рейд исходной продажи",
  "Предмет исходной продажи",
  "FIFO-аллокация (Adena)",
] as const;

const CSV_COLUMN = {
  shareAmount: 12,
  memberId: 13,
  memberNickname: 14,
  weight: 15,
  distributionMethod: 16,
  algorithmVersion: 17,
  account: 18,
  debit: 19,
  credit: 20,
  relatedSaleId: 21,
  relatedRaid: 22,
  relatedItem: 23,
  allocationAmount: 24,
} as const;

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

function createRow(recordType: string, common: readonly string[]) {
  return [
    recordType,
    ...common,
    ...Array<string>(CSV_HEADERS.length - 1 - common.length).fill(""),
  ];
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
        `Posted ledger transaction ${transaction.id} has no source record.`,
      );
    }

    const sourceType = sale ? "SALE" : "PAYOUT";
    const sourceId = sale?.id ?? payment?.id ?? "";
    const operationAt =
      sale?.receivedAt ?? payment?.paidAt ?? transaction.createdAt;
    const comment = sale?.comment ?? payment?.comment ?? "";
    const itemName = sale
      ? sale.lootDrop.item.displayName || sale.lootDrop.item.canonicalName
      : "";
    const raidName = sale?.raid.name ?? "";
    const quantity = sale?.quantitySold.toString() ?? "";
    const totalAmount = sale
      ? sale.totalPrice.toString()
      : (payment?.amount.toString() ?? "");
    const memberNickname = payment?.nicknameSnapshot ?? "";

    const common = [
      transaction.id,
      transaction.type,
      transaction.postedAt?.toISOString() ?? transaction.createdAt.toISOString(),
      sourceType,
      sourceId,
      operationAt.toISOString(),
      comment,
      itemName,
      raidName,
      quantity,
      totalAmount,
    ];

    if (sale) {
      for (const share of sale.shares) {
        const row = createRow("Начисление", common);
        row[CSV_COLUMN.shareAmount] = share.amount.toString();
        row[CSV_COLUMN.memberId] = share.memberId;
        row[CSV_COLUMN.memberNickname] = share.nicknameSnapshot;
        row[CSV_COLUMN.weight] = share.weightSnapshot.toString();
        row[CSV_COLUMN.distributionMethod] = share.distributionMethod;
        row[CSV_COLUMN.algorithmVersion] = share.algorithmVersion.toString();
        rows.push(row);
      }
    }

    for (const entry of transaction.entries) {
      const relatedShare = sale?.shares.find(
        (share) => share.memberId === entry.partyMemberId,
      );
      const row = createRow("Проводка", common);
      row[CSV_COLUMN.memberId] = entry.partyMemberId ?? payment?.memberId ?? "";
      row[CSV_COLUMN.memberNickname] = relatedShare?.nicknameSnapshot ?? memberNickname;
      row[CSV_COLUMN.weight] = relatedShare?.weightSnapshot.toString() ?? "";
      row[CSV_COLUMN.distributionMethod] =
        relatedShare?.distributionMethod ?? sale?.distributionMethod ?? "";
      row[CSV_COLUMN.algorithmVersion] =
        relatedShare?.algorithmVersion.toString() ??
        sale?.algorithmVersion.toString() ??
        "";
      row[CSV_COLUMN.account] = entry.accountType;
      row[CSV_COLUMN.debit] = entry.debit.toString();
      row[CSV_COLUMN.credit] = entry.credit.toString();
      rows.push(row);
    }

    if (payment) {
      for (const allocation of payment.allocations) {
        const allocatedSale = allocation.saleShare.saleTransaction;
        const row = createRow("FIFO-аллокация", common);
        row[CSV_COLUMN.memberId] = payment.memberId;
        row[CSV_COLUMN.memberNickname] = payment.nicknameSnapshot;
        row[CSV_COLUMN.relatedSaleId] = allocatedSale.id;
        row[CSV_COLUMN.relatedRaid] = allocatedSale.raid.name;
        row[CSV_COLUMN.relatedItem] =
          allocatedSale.lootDrop.item.displayName ||
          allocatedSale.lootDrop.item.canonicalName;
        row[CSV_COLUMN.allocationAmount] = allocation.amount.toString();
        rows.push(row);
      }
    }
  }

  return `\uFEFF${[encodeCsvRow(CSV_HEADERS), ...rows.map(encodeCsvRow)].join("\r\n")}\r\n`;
}
