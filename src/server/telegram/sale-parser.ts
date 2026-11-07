export const TELEGRAM_SALE_EXAMPLE = `Successful sale
Item: Giant's Codex
Quantity: 4
Price per item: 42,222,222 Adena
Total: 168,888,888 Adena
Current Adena: 999,999,999`;

export const BOHPTS_SALE_EXAMPLE = `💰 Successful sale
Buyer: Love

Items:
- Sealed Moirai Leather Boots × 1 @ 22 222 222 Adena

Total: 22 222 222 Adena
💰 Current adena: 854 896 093

🌟 Phenomenon x20 · 👤 Miva`;

export const MAX_ADENA = 9_223_372_036_854_775_807n;
export type TelegramSaleRow = { name: string; quantity: number; proceeds: bigint };
export class TelegramReviewError extends Error {}

export function normalizeTelegramName(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

function integer(value: string): bigint {
  const cleaned = value
    .trim()
    .replace(/\s*(?:[\p{Extended_Pictographic}\uFE0F\u200D]\s*)*Adena\s*$/iu, "")
    .trim();
  if (!/^(?:\d+|\d{1,3}(?:[, ]\d{3})+)$/.test(cleaned)) {
    throw new TelegramReviewError("Сумма должна быть целым числом Adena без дробей.");
  }
  const amount = BigInt(cleaned.replace(/[, ]/g, ""));
  if (amount <= 0n || amount > MAX_ADENA)
    throw new TelegramReviewError("Сумма Adena вне допустимого диапазона.");
  return amount;
}

type Draft = { name: string; quantity?: number; price?: bigint; subtotal?: bigint };
const saleNotice =
  /(?:successful sale|sale successful|successfully sold|sale completed|items? (?:has been |have been )?sold|your items? (?:has been |have been |was |were )?purchased)/i;
const headerLine = new RegExp(`^(?:${saleNotice.source})[!:. ]*$`, "i");

/** Supports BOHPTS compact notices and the original translated label format. */
export function parseTelegramSale(text: string): TelegramSaleRow[] | null {
  if (!saleNotice.test(text)) return null;
  if (text.length > 16_000) throw new TelegramReviewError("Сообщение слишком длинное.");
  const rows: TelegramSaleRow[] = [];
  let draft: Draft | undefined;
  let overall: bigint | undefined;
  function flush() {
    if (!draft) return;
    if (!draft.name || draft.name.length > 240 || !draft.quantity || draft.quantity > 1_000_000)
      throw new TelegramReviewError("Не удалось определить предмет или количество.");
    const calculated = draft.price === undefined ? undefined : draft.price * BigInt(draft.quantity);
    if (calculated !== undefined && draft.subtotal !== undefined && calculated !== draft.subtotal)
      throw new TelegramReviewError("Цена и сумма строки не совпадают.");
    const proceeds = draft.subtotal ?? calculated;
    if (proceeds === undefined || proceeds <= 0n || proceeds > MAX_ADENA)
      throw new TelegramReviewError("Не указана корректная цена или сумма строки.");
    rows.push({ name: draft.name, quantity: draft.quantity, proceeds });
    if (rows.length > 50) throw new TelegramReviewError("В сообщении больше 50 строк предметов.");
    draft = undefined;
  }
  for (const original of text.split(/\r?\n/)) {
    // BOHPTS identifies the server and character in a non-financial footer.
    if (
      /^[✨🌟⭐]\uFE0F?\s+[\p{L}\p{N}][\p{L}\p{N} ._-]*\s+x\d+\s*[.·]\s*👤\uFE0F?\s+[\p{L}\p{N}_-]+\s*$/u.test(
        original.trim(),
      )
    )
      continue;
    const line = original.trim().replace(/^[^\p{L}\p{N}]+/u, "");
    if (!line || headerLine.test(line)) continue;
    if (/^Buyer:\s*\S.{0,239}$/i.test(line) || /^Items:\s*$/i.test(line)) continue;
    if (/^(?:current adena|adena balance|balance)\s*[:=]/i.test(line)) continue;
    const label = line.match(
      /^(item|name|quantity|qty|amount|price per item|unit price|price|row total|subtotal|total|sum)\s*[:=]\s*(.+)$/i,
    );
    if (label) {
      const key = label[1].toLowerCase();
      const value = label[2].trim();
      if (key === "item" || key === "name") {
        flush();
        draft = { name: value };
        continue;
      }
      if (key === "total" || key === "sum") {
        if (overall !== undefined)
          throw new TelegramReviewError("Общая сумма указана несколько раз.");
        overall = integer(value);
        continue;
      }
      if (!draft) throw new TelegramReviewError("Поле строки указано до названия предмета.");
      if (["quantity", "qty", "amount"].includes(key)) {
        if (draft.quantity !== undefined || !/^\d+(?:\s*(?:pcs\.?|pieces))?$/i.test(value))
          throw new TelegramReviewError("Проверьте количество предметов.");
        draft.quantity = Number(value.replace(/\D.*$/, ""));
      } else if (key === "row total" || key === "subtotal") {
        if (draft.subtotal !== undefined)
          throw new TelegramReviewError("Сумма строки указана дважды.");
        draft.subtotal = integer(value);
      } else {
        if (draft.price !== undefined) throw new TelegramReviewError("Цена строки указана дважды.");
        draft.price = integer(value);
      }
      continue;
    }
    // Compact rows explicitly distinguish a unit price (@ / each) and a row total (=).
    const compact = line.match(
      /^(.+?)\s+[x×]\s*(\d+)\s*(@|=|—|-)\s*([\d, ]+(?:\s*(?:[\p{Extended_Pictographic}\uFE0F\u200D]\s*)*Adena)?)\s*(each|per item)?[.!]?$/iu,
    );
    if (compact) {
      flush();
      draft = { name: compact[1].trim(), quantity: Number(compact[2]) };
      const amount = integer(compact[4]);
      if (compact[3] === "@" || compact[5]) draft.price = amount;
      else if (compact[3] === "=") draft.subtotal = amount;
      else
        throw new TelegramReviewError("Укажите each для цены за единицу или = для суммы строки.");
      flush();
      continue;
    }
    throw new TelegramReviewError(`Неизвестная строка формата: ${line.slice(0, 100)}`);
  }
  flush();
  if (!rows.length) throw new TelegramReviewError("В уведомлении о продаже нет строк предметов.");
  const total = rows.reduce((sum, row) => sum + row.proceeds, 0n);
  if (total > MAX_ADENA || (overall !== undefined && total !== overall))
    throw new TelegramReviewError("Сумма строк не совпадает с Total / Sum.");
  return rows;
}

export type LootCandidate = {
  id: string;
  itemId: string;
  raidId: string;
  raidName: string;
  quantity: number;
  occurredAt: Date;
  createdAt: Date;
  sold: number;
};
export type TelegramAllocation = {
  lootDropId: string;
  raidId: string;
  raidName: string;
  itemName: string;
  quantity: number;
  amount: string;
  saleId?: string;
};

export function allocateTelegramRow(
  row: TelegramSaleRow,
  candidates: LootCandidate[],
): TelegramAllocation[] {
  const ordered = [...candidates].sort(
    (a, b) =>
      a.occurredAt.getTime() - b.occurredAt.getTime() ||
      a.createdAt.getTime() - b.createdAt.getTime() ||
      a.id.localeCompare(b.id),
  );
  let remaining = row.quantity;
  const allocations: TelegramAllocation[] = [];
  const unit = row.proceeds / BigInt(row.quantity);
  let remainder = row.proceeds % BigInt(row.quantity);
  for (const loot of ordered) {
    const quantity = Math.min(remaining, loot.quantity - loot.sold);
    if (quantity <= 0) continue;
    const extra = remainder < BigInt(quantity) ? remainder : BigInt(quantity);
    const amount = unit * BigInt(quantity) + extra;
    remainder -= extra;
    if (amount <= 0n)
      throw new TelegramReviewError(
        "Недостаточно Adena для положительной оплаты каждого поступления.",
      );
    allocations.push({
      lootDropId: loot.id,
      raidId: loot.raidId,
      raidName: loot.raidName,
      itemName: row.name,
      quantity,
      amount: amount.toString(),
    });
    remaining -= quantity;
    if (!remaining) return allocations;
  }
  throw new TelegramReviewError(
    `Недостаточно непроданного лута: ${row.name} (не хватает ${remaining}).`,
  );
}
