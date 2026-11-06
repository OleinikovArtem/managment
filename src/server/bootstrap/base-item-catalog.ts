import { normalizeItemName } from "@/features/items/item-schema";
import {
  classifyHighFiveItem,
  legacyHighFiveCategories,
} from "@/server/bootstrap/high-five-item-classification";
import baseItemDump from "../../../prisma/seeds/lineage2-high-five-items.json";

type ItemCatalogSeedClient = {
  item: {
    findMany(args: {
      where: { normalizedName: { in: string[] } };
      select: {
        normalizedName: true;
        category: true;
      };
    }): Promise<{
      normalizedName: string;
      category: string | null;
    }[]>;
    upsert(args: {
      where: {
        normalizedName: string;
      };
      update: {
        category: string;
        grade: string | null;
        itemType: string | null;
        itemSubtype: string | null;
        isRare: boolean;
      };
      create: {
        canonicalName: string;
        normalizedName: string;
        category: string;
        grade: string | null;
        itemType: string | null;
        itemSubtype: string | null;
        isRare: boolean;
        gameVersion: string;
      };
    }): Promise<unknown>;
  };
};

export async function ensureBaseItemCatalog(
  transaction: ItemCatalogSeedClient,
) {
  const seedItems = baseItemDump.items.map((item) => ({
    ...item,
    normalizedName: normalizeItemName(item.canonicalName),
    classification: classifyHighFiveItem(item),
  }));
  const existingItems = await transaction.item.findMany({
    where: {
      normalizedName: { in: seedItems.map((item) => item.normalizedName) },
    },
    select: {
      normalizedName: true,
      category: true,
    },
  });
  const existingByName = new Map(
    existingItems.map((item) => [item.normalizedName, item]),
  );
  const missingItems = seedItems.filter(
    (item) => !existingByName.has(item.normalizedName),
  );
  const itemsToReconcile = seedItems.filter((item) => {
    const existing = existingByName.get(item.normalizedName);
    return (
      !existing ||
      legacyHighFiveCategories[item.category]?.includes(existing.category ?? "") ===
        true
    );
  });

  for (const item of itemsToReconcile) {
    await transaction.item.upsert({
      where: {
        normalizedName: item.normalizedName,
      },
      update: item.classification,
      create: {
        canonicalName: item.canonicalName,
        normalizedName: item.normalizedName,
        ...item.classification,
        gameVersion: baseItemDump.gameVersion,
      },
    });
  }
  return missingItems.length;
}
