import { normalizeItemName } from "@/features/items/item-schema";
import {
  classifyHighFiveItem,
  legacyHighFiveCategories,
} from "@/server/bootstrap/high-five-item-classification";
import baseItemDump from "../../../prisma/seeds/lineage2-high-five-items.json";

type ItemCatalogSeedClient = {
  item: {
    findMany(args: {
      where: { partyId: string; normalizedName: { in: string[] } };
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
        partyId_normalizedName: { partyId: string; normalizedName: string };
      };
      update: {
        category: string;
        grade: string | null;
        itemType: string | null;
        itemSubtype: string | null;
        isRare: boolean;
      };
      create: {
        partyId: string;
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
  partyId: string,
) {
  const seedItems = baseItemDump.items.map((item) => ({
    ...item,
    normalizedName: normalizeItemName(item.canonicalName),
    classification: classifyHighFiveItem(item),
  }));
  const existingItems = await transaction.item.findMany({
    where: {
      partyId,
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
        partyId_normalizedName: {
          partyId,
          normalizedName: item.normalizedName,
        },
      },
      update: item.classification,
      create: {
        partyId,
        canonicalName: item.canonicalName,
        normalizedName: item.normalizedName,
        ...item.classification,
        gameVersion: baseItemDump.gameVersion,
      },
    });
  }
  return missingItems.length;
}
