import { z } from "zod";
import { catalogId } from "@/features/instances/catalog-schema";
import type { RaidFormValues } from "./raid-schema";

type LootRows = RaidFormValues["lootDrops"];

const storedLootRow = z.object({
  itemId: catalogId,
  quantity: z.number().nullable(),
  comment: z.string().max(500).optional(),
});

function serializeLoot(rows: LootRows) {
  return JSON.stringify(
    rows.map(({ itemId, quantity, comment }) => ({ itemId, quantity, comment })),
  );
}

export function readRaidLootDraft(key: string): LootRows {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    if (!Array.isArray(stored)) return [];

    const rows = new Map<string, LootRows[number]>();
    for (const value of stored) {
      const entry = storedLootRow.safeParse(value);
      if (entry.success && !rows.has(entry.data.itemId)) {
        rows.set(entry.data.itemId, { ...entry.data, quantity: entry.data.quantity ?? NaN });
      }
    }
    return [...rows.values()];
  } catch {
    return [];
  }
}

export function saveRaidLootDraft(key: string, rows: LootRows) {
  try {
    if (rows.length > 0) localStorage.setItem(key, serializeLoot(rows));
    else localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function clearSubmittedRaidLootDraft(key: string, submitted: LootRows) {
  try {
    // A different tab may have saved a newer draft while this raid was being created.
    if (localStorage.getItem(key) === serializeLoot(submitted)) localStorage.removeItem(key);
  } catch {
    // A browser storage failure must not change the result of creating the raid.
  }
}
