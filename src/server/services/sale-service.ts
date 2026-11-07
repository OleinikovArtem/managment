import "server-only";

import {
  groupedSaleInputSchema,
  saleInputSchema,
  type SaleInput,
} from "@/features/sales/sale-schema";
import { SaleOperationError } from "@/features/sales/sale-errors";
import {
  getPartyFinancialBalances,
  listPartyLedgerTransactions,
  listPartySales,
  registerPartyGroupedSale,
  registerPartySale,
} from "@/server/repositories/sale-repository";
import { createFinancialHistoryCsv } from "@/server/services/financial-history-csv";

export class SaleInputError extends SaleOperationError {
  constructor(message: string) {
    super(message);
    this.name = "SaleInputError";
  }
}

function parseSaleInput(input: unknown): SaleInput {
  const parsed = saleInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new SaleInputError(parsed.error.issues[0]?.message ?? "Проверьте данные продажи.");
  }
  return parsed.data;
}

export async function registerSale(partyId: string, input: unknown) {
  const validInput = parseSaleInput(input);
  const sale = await registerPartySale(partyId, {
    lootDropId: validInput.lootDropId,
    quantitySold: validInput.quantitySold,
    totalPrice: BigInt(validInput.totalPrice),
    receivedAt: new Date(validInput.receivedAt),
    comment: validInput.comment,
    idempotencyKey: validInput.idempotencyKey,
  });

  return {
    id: sale.id,
    receivedAt: sale.receivedAt.toISOString(),
    totalPrice: sale.totalPrice.toString(),
    quantitySold: sale.quantitySold,
    shares: sale.shares.map((share) => ({
      memberId: share.memberId,
      nicknameSnapshot: share.nicknameSnapshot,
      amount: share.amount.toString(),
      weightSnapshot: share.weightSnapshot,
    })),
  };
}

export async function registerGroupedSale(partyId: string, input: unknown) {
  const parsed = groupedSaleInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new SaleInputError(parsed.error.issues[0]?.message ?? "Проверьте данные продажи.");
  }
  const validInput = parsed.data;
  const sales = await registerPartyGroupedSale(partyId, {
    itemId: validInput.itemId,
    quantitySold: validInput.quantitySold,
    totalPrice: BigInt(validInput.totalPrice),
    receivedAt: new Date(validInput.receivedAt),
    comment: validInput.comment,
    idempotencyKey: validInput.idempotencyKey,
  });
  return sales.map((sale) => ({
    id: sale.id,
    lootDropId: sale.lootDropId,
    receivedAt: sale.receivedAt.toISOString(),
    totalPrice: sale.totalPrice.toString(),
    quantitySold: sale.quantitySold,
    shares: sale.shares.map((share) => ({
      memberId: share.memberId,
      nicknameSnapshot: share.nicknameSnapshot,
      amount: share.amount.toString(),
      weightSnapshot: share.weightSnapshot,
    })),
  }));
}

export async function getSales(partyId: string) {
  return listPartySales(partyId);
}

export async function getPartyBalances(partyId: string) {
  return getPartyFinancialBalances(partyId);
}

export async function getFinancialHistory(partyId: string) {
  return listPartyLedgerTransactions(partyId);
}

export async function exportFinancialHistoryCsv(partyId: string) {
  const transactions = await getFinancialHistory(partyId);
  return createFinancialHistoryCsv(transactions);
}
