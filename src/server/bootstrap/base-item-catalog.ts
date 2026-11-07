import { normalizeItemName } from "@/features/items/item-schema";
import { classifyHighFiveItem } from "./high-five-item-classification";
import baseItemDump from "../../../prisma/seeds/lineage2-high-five-items.json";
import instanceLootDump from "../../../prisma/seeds/bohpts-stage-1-loot.json";

const supplementalItems = Object.values(instanceLootDump.sources)
  .flatMap((source) => source.items)
  .filter((item, index, all) => all.findIndex((candidate) => candidate.name === item.name) === index)
  .map((item) => ({ canonicalName: item.name, category: item.category }));
const allBaseItems = [
  ...baseItemDump.items,
  ...supplementalItems.filter((item) => !baseItemDump.items.some((existing) => existing.canonicalName === item.canonicalName)),
];

// Administrative bootstrap only. Preserve existing catalog and party-owned rows.
export async function ensureBaseItemCatalog(client: { item: { createMany(args: { data: { canonicalName: string; normalizedName: string; partyId: null; category: string; grade: string | null; itemType: string | null; itemSubtype: string | null; isRare: boolean; gameVersion: string }[]; skipDuplicates: true }): Promise<{ count: number }> } }) {
  const result = await client.item.createMany({ data: allBaseItems.map(item => ({ canonicalName: item.canonicalName, normalizedName: normalizeItemName(item.canonicalName), partyId: null, ...classifyHighFiveItem(item), gameVersion: baseItemDump.gameVersion })), skipDuplicates: true });
  return result.count;
}
