type BaseItemDumpEntry = {
  canonicalName: string;
  category: string;
};

export type ItemClassification = {
  category: string;
  grade: string | null;
  itemType: string | null;
  itemSubtype: string | null;
  isRare: boolean;
};

export const legacyHighFiveCategories: Record<string, string[]> = {
  Armor: ["S+ Armor"],
  Weapon: ["Best A+ Weapons"],
  Materials: ["Life Stones", "Neolithics"],
  "Skill Book": ["Skill Books"],
  "Enchant Scroll": ["Enchant Scrolls"],
};

const weaponGrades: Record<string, string> = {
  "Tallum Blade": "A",
  "Sword of Miracles": "A",
  "Shyeed's Bow": "A",
  "Dragon Hunter Axe": "A",
  "Naga Storm": "A",
  "Demon Splinter": "A",
  "Heaven's Divider": "A",
  "Dark Legion's Edge": "S",
  "Forgotten Blade": "S",
  "Angel Slayer": "S",
  "Draconic Bow": "S",
  "Basalt Battlehammer": "S",
  "Arcana Mace": "S",
  "Imperial Staff": "S",
  "Soul Separator": "S",
};

const weaponTypes: Record<string, string> = {
  "Tallum Blade": "Sword",
  "Dark Legion's Edge": "Dagger",
  "Sword of Miracles": "Sword",
  "Forgotten Blade": "Sword",
  "Angel Slayer": "Dagger",
  "Draconic Bow": "Bow",
  "Shyeed's Bow": "Bow",
  "Basalt Battlehammer": "Blunt",
  "Dragon Hunter Axe": "Blunt",
  "Arcana Mace": "Blunt",
  "Imperial Staff": "Staff",
  "Soul Separator": "Dagger",
  "Naga Storm": "Dagger",
  "Demon Splinter": "Blunt",
  "Heaven's Divider": "Two-handed Sword",
  "Dynasty Sword": "Sword",
  "Dynasty Bow": "Bow",
  "Dynasty Knife": "Dagger",
  "Vesper Cutter": "Sword",
  "Vesper Shaper": "Dagger",
  "Vesper Thrower": "Bow",
  "Vesper Caster": "Blunt",
  "Vesper Retributer": "Two-handed Blunt",
  "Elegia Cutter": "Sword",
};

function getArmorType(name: string): string | null {
  if (name.startsWith("Imperial Crusader ")) return "Heavy";
  if (name.startsWith("Draconic Leather ")) return "Light";
  if (name.startsWith("Major Arcana ")) return "Robe";
  if (name.startsWith("Vesper Noble ")) return "Heavy";
  if (name.startsWith("Elegia ")) return "Heavy";
  if (name.startsWith("Dynasty Leather ")) return "Light";
  if (
    name.startsWith("Dynasty ") &&
    !name.includes("Leather") &&
    !name.startsWith("Dynasty Tunic") &&
    !name.startsWith("Dynasty Stockings") &&
    !name.startsWith("Dynasty Circlet")
  ) {
    return "Heavy";
  }
  if (
    name.startsWith("Dynasty Tunic") ||
    name.startsWith("Dynasty Stockings") ||
    name.startsWith("Dynasty Circlet")
  ) {
    return "Robe";
  }
  return null;
}

function getArmorSlot(name: string): string | null {
  const slots: [string, string][] = [
    ["Breastplate", "Chest"],
    ["Leather Armor", "Chest"],
    ["Gaiters", "Legs"],
    ["Leather Leggings", "Legs"],
    ["Stockings", "Legs"],
    ["Tunic", "Chest"],
    ["Gauntlets", "Gloves"],
    ["Leather Gloves", "Gloves"],
    ["Gloves", "Gloves"],
    ["Boots", "Boots"],
    ["Shoes", "Boots"],
    ["Helmet", "Helmet"],
    ["Circlet", "Helmet"],
    ["Robe", "Chest"],
  ];
  const slot = slots.find(([suffix]) => name.endsWith(suffix));
  return slot?.[1] ?? null;
}

export function classifyHighFiveItem(item: BaseItemDumpEntry): ItemClassification {
  const isRare = /^Rare /i.test(item.canonicalName);
  const canonicalName = item.canonicalName.replace(/^Rare /i, "");

  if (item.category === "Armor") {
    const grade =
      canonicalName.startsWith("Imperial Crusader ") ||
      canonicalName.startsWith("Draconic Leather ") ||
      canonicalName.startsWith("Major Arcana ")
        ? "S"
        : canonicalName.startsWith("Dynasty ")
          ? "S80"
          : canonicalName.startsWith("Vesper Noble ") || canonicalName.startsWith("Elegia ")
            ? "S84"
            : null;
    const itemType = getArmorSlot(canonicalName);
    const itemSubtype = getArmorType(canonicalName);

    if (!grade || !itemType || !itemSubtype) {
      throw new Error(`Unknown High Five armor classification: ${item.canonicalName}`);
    }

    return { category: "Armor", grade, itemType, itemSubtype, isRare };
  }

  if (item.category === "Weapon") {
    const grade = canonicalName.startsWith("Dynasty ")
      ? "S80"
      : canonicalName.startsWith("Vesper ")
        ? "S84"
        : canonicalName.startsWith("Elegia ")
          ? "S84"
          : weaponGrades[canonicalName];
    const itemType = weaponTypes[canonicalName] ?? "Weapon";
    return { category: "Weapon", grade: grade ?? null, itemType, itemSubtype: null, isRare };
  }

  if (item.category === "Materials" && /Life Stone/i.test(canonicalName)) {
    const itemSubtype = /^(Mid-grade|High-grade|Top-grade) /i.exec(canonicalName)?.[1] ?? null;
    const level = /Lv\. (\d+)/i.exec(canonicalName)?.[1];
    return {
      category: "Materials",
      grade: level ? `Lv. ${level}` : null,
      itemType: "Life Stone",
      itemSubtype,
      isRare,
    };
  }

  if (item.category === "Materials" && /Neolithic Crystal/i.test(canonicalName)) {
    return {
      category: "Materials",
      grade: null,
      itemType: "Neolithic Crystal",
      itemSubtype: null,
      isRare,
    };
  }

  if (item.category === "Skill Book") {
    return {
      category: "Skill Book",
      grade: null,
      itemType: "Spellbook",
      itemSubtype: null,
      isRare,
    };
  }

  if (item.category === "Enchant Scroll") {
    const grade = /\(([ABS])-grade\)/i.exec(canonicalName)?.[1] ?? null;
    const itemType = canonicalName.includes("Giant's Codex")
      ? "Giant's Codex"
      : /Enchant (?:Stone: )?Weapon/i.test(canonicalName)
        ? "Weapon Enchant"
        : /Enchant (?:Stone: )?Armor/i.test(canonicalName)
          ? "Armor Enchant"
          : "Enchant Item";
    const itemSubtype = canonicalName.includes("Mastery")
      ? "Mastery"
      : canonicalName.startsWith("Blessed ")
        ? "Blessed"
        : canonicalName.startsWith("Lucky ")
          ? "Lucky"
          : null;
    return {
      category: "Enchant Scroll",
      grade,
      itemType,
      itemSubtype,
      isRare,
    };
  }

  if (item.category === "Materials") {
    return {
      category: "Materials",
      grade: null,
      itemType: /CRP Scroll/i.test(canonicalName) ? "Clan Reputation Scroll" : "Material",
      itemSubtype: null,
      isRare,
    };
  }

  throw new Error(`Unknown High Five item category: ${item.category}`);
}
