import { normalizeItemName } from "@/features/items/item-schema";
import baseItemDump from "../../../prisma/seeds/lineage2-high-five-items.json";

type ItemCatalogSeedClient = {
  item: {
    findMany(args: {
      where: { partyId: string; normalizedName: { in: string[] } };
      select: { normalizedName: true };
    }): Promise<{ normalizedName: string }[]>;
    upsert(args: {
      where: {
        partyId_normalizedName: { partyId: string; normalizedName: string };
      };
      update: Record<string, never>;
      create: {
        partyId: string;
        canonicalName: string;
        normalizedName: string;
        category: string;
        gameVersion: string;
      };
    }): Promise<unknown>;
  };
};

export async function ensureBaseItemCatalog(
  transaction: ItemCatalogSeedClient,
  partyId: string,
) {
  const seedItems = baseItemDump.items.map((item) => ({
    ...item,
    normalizedName: normalizeItemName(item.canonicalName),
  }));
  const existingItems = await transaction.item.findMany({
    where: {
      partyId,
      normalizedName: { in: seedItems.map((item) => item.normalizedName) },
    },
    select: { normalizedName: true },
  });
  const existingNames = new Set(
    existingItems.map((item) => item.normalizedName),
  );
  const missingItems = seedItems.filter(
    (item) => !existingNames.has(item.normalizedName),
  );

  for (const item of missingItems) {
    await transaction.item.upsert({
      where: {
        partyId_normalizedName: {
          partyId,
          normalizedName: item.normalizedName,
        },
      },
      update: {},
      create: {
        partyId,
        canonicalName: item.canonicalName,
        normalizedName: item.normalizedName,
        category: item.category,
        gameVersion: baseItemDump.gameVersion,
      },
    });
  }
  return missingItems.length;
}
