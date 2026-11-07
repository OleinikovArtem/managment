import { Package, Shield } from "lucide-react";
import { LOCAL_CLASS_ICONS } from "@/features/members/class-icon-map";

const ITEM_ICON_BASE = "/game-icons/items";
const LOCAL_ITEM_KEYS = new Set(["weapon_vesper_cutter_i00", "armor_t94_u_i01", "etc_scroll_of_enchant_weapon_i05", "etc_scroll_of_enchant_armor_i05", "etc_mineral_rare_i03", "etc_codex_of_giant_i00"]);
const userTableIcons: Record<string, string> = {
  "elysian": "elysian.png",
  "doom crusher": "doom-crusher.png",
  "tallum glaive": "tallum-glaive.png",
  "dark legion's edge": "dark-legion-s-edge.png",
  "dragon slayer": "dragon-slayer.png",
  "soul separator": "soul-separator.png",
  "soul bow": "soul-bow.png",
  "dragon grinder": "dragon-grinder.png",
  "flaming dragon skull": "flaming-dragon-skull.png",
  "sword of miracles": "sword-of-miracles.png",
  "branch of the mother tree": "branch-of-the-mother-tree.png",
  "keshanberk*damascus": "keshanberk-damascus.png",
  "damascus*damascus": "keshanberk-damascus.png",
  "blessed scroll: enchant armor (b-grade)": "blessed-scroll-enchant-armor-b-grade.png",
  "blessed scroll: enchant weapon (b-grade)": "blessed-scroll-enchant-weapon-b-grade.png",
  "scroll: enchant armor (a-grade)": "scroll-enchant-armor-a-grade.jpg",
  "scroll: enchant weapon (a-grade)": "scroll-enchant-weapon-a-grade.jpg",
  "blessed scroll: enchant armor (a-grade)": "blessed-scroll-enchant-armor-a-grade.png",
  "blessed scroll: enchant weapon (a-grade)": "blessed-scroll-enchant-weapon-a-grade.png",
  "lucky enchant stone: armor (b-grade)": "lucky-enchant-stone-armor-b-grade.webp",
  "lucky enchant stone: weapon (b-grade)": "lucky-enchant-stone-weapon-b-grade.webp",
  "lucky enchant stone: armor (a-grade)": "lucky-enchant-stone-armor-a-grade.jpg",
  "lucky enchant stone: weapon (a-grade)": "lucky-enchant-stone-weapon-a-grade.jpg",
  "life stone": "life-stone.jpg",
  "mid-grade life stone": "mid-grade-life-stone.jpg",
  "high-grade life stone": "high-grade-life-stone.png",
  "top-grade life stone": "top-grade-life-stone.png",
  "giant's codex": "giant-s-codex.png",
  "giant's codex - mastery": "giant-s-codex-mastery.png",
  "crp scroll (500)": "crp-scroll-500.webp",
};

const armorSets: { match: RegExp; code: string; variant?: string }[] = [
  { match: /^imperial crusader\b/i, code: "t88" },
  { match: /^draconic leather\b/i, code: "t86" },
  { match: /^major arcana\b/i, code: "t90" },
  { match: /^dynasty\b/i, code: "t91" },
  { match: /^elegia\b/i, code: "t97" },
  { match: /^vesper noble\b/i, code: "t94", variant: "01" },
];

function armorIconKey(name: string) {
  const set = armorSets.find(({ match }) => match.test(name));
  if (!set) return null;
  const slots: [RegExp, string][] = [
    [/\b(robe|tunic)\b/i, "ul"],
    [/\b(breastplate|leather armor)\b/i, "u"],
    [/\b(gaiters|leggings|stockings)\b/i, "l"],
    [/\b(gauntlets|gloves)\b/i, "g"],
    [/\b(boots|shoes)\b/i, "b"],
    [/\b(helmet|circlet)\b/i, "h"],
  ];
  const slot = slots.find(([pattern]) => pattern.test(name))?.[1];
  if (!slot) return null;
  if (slot === "h") return "armor_helmet_i00";
  if (slot === "ul") return `armor_${set.code}_ul_i${set.variant ?? "00"}`;
  return `armor_${set.code}_${slot}_i${set.variant ?? "00"}`;
}

const namedItemIcons: Record<string, string> = {
  "giant's codex": "etc_codex_of_giant_i00",
  "giant's codex - oblivion": "etc_codex_of_giant_i01",
  "giant's codex - discipline": "etc_codex_of_giant_i02",
  "giant's codex - mastery": "etc_codex_of_giant_i03",
  "neolithic crystal - s": "etc_warding_orb_red_i00",
  "neolithic crystal - s80": "etc_warding_orb_black_i00",
  "neolithic crystal - s84": "etc_warding_orb_gold_i00",
  "vesper cutter": "weapon_vesper_cutter_i00",
  "vesper shaper": "weapon_vesper_shaper_i00",
  "vesper thrower": "weapon_vesper_thrower_i00",
  "vesper caster": "weapon_vesper_burster_i00",
  "vesper retributer": "weapon_vesper_retributer_i00",
  "tallum blade": "weapon_tallum_blade_i00",
  "dark legion's edge": "weapon_dark_legions_edge_i00",
  "sword of miracles": "weapon_sword_of_miracles_i00",
  "forgotten blade": "weapon_forgotten_blade_i00",
  "angel slayer": "weapon_angel_slayer_i00",
  "draconic bow": "weapon_draconic_bow_i00",
  "shyeed's bow": "weapon_shyeed_bow_i00",
  "basalt battlehammer": "weapon_basalt_battlehammer_i00",
  "dragon hunter axe": "weapon_dragon_hunter_axe_i00",
  "arcana mace": "weapon_arcana_mace_i00",
  "imperial staff": "weapon_imperial_staff_i00",
  "soul separator": "weapon_soul_separator_i00",
  "naga storm": "weapon_naga_storm_i00",
  "demon splinter": "weapon_demon_splinter_i00",
  "heaven's divider": "weapon_heavens_divider_i00",
  "dynasty sword": "weapon_dynasty_blade_i00",
  "dynasty bow": "weapon_dynasty_bow_i00",
  "dynasty knife": "weapon_dynasty_knife_i00",
  "elegia cutter": "weapon_elegia_cutter_i00",
};

function itemIconKey(name: string, category?: string | null) {
  const value = name.trim().toLocaleLowerCase();
  const namedIcon = namedItemIcons[value];
  if (namedIcon) return namedIcon;

  if (category === "Armor" || /armor|breastplate|gaiters|boots|helmet|circlet|gloves|robe|stockings|shoes|tunic/i.test(name)) {
    return armorIconKey(name);
  }

  if (/life stone/i.test(value)) {
    const grade = /top-grade/i.test(value) ? "legend" : /high-grade/i.test(value) ? "rare" : /mid-grade/i.test(value) ? "special" : null;
    const level = Number(/lv\.\s*(\d+)/i.exec(value)?.[1] ?? 0);
    const tier = level >= 80 ? "03" : level >= 70 ? "02" : level >= 58 ? "01" : "00";
    return `etc_mineral_${grade ? `${grade}_` : ""}i${tier}`;
  }

  if (/neolithic crystal/i.test(value)) return "etc_warding_orb_gold_i00";
  if (/enchant weapon/i.test(value)) return "etc_scroll_of_enchant_weapon_i05";
  if (/enchant armor/i.test(value)) return "etc_scroll_of_enchant_armor_i05";
  if (/spellbook|skill book|forgotten book/i.test(value)) return "etc_spellbook_i00";

  if (/vesper/i.test(value) && category === "Weapon") {
    if (/retributer/i.test(value)) return "weapon_vesper_retributer_i00";
    if (/shaper/i.test(value)) return "weapon_vesper_shaper_i00";
    if (/thrower/i.test(value)) return "weapon_vesper_thrower_i00";
    if (/caster/i.test(value)) return "weapon_vesper_burster_i00";
    if (/cutter/i.test(value)) return "weapon_vesper_cutter_i00";
  }

  return null;
}

export function itemIconUrl(name: string, category?: string | null) {
  const tableIcon = userTableIcons[name.trim().toLocaleLowerCase()];
  if (tableIcon) return `${ITEM_ICON_BASE}/${tableIcon}`;
  const key = itemIconKey(name, category);
  return key && LOCAL_ITEM_KEYS.has(key) ? `${ITEM_ICON_BASE}/${key}.png` : null;
}

export function classIconUrl(className: string) {
  return LOCAL_CLASS_ICONS[className.trim().toLowerCase()] ?? null;
}

export function GameIcon({ kind, name, category, size = "md" }: { kind: "item" | "class"; name: string; category?: string | null; size?: "sm" | "md" | "lg" }) {
  const url = kind === "item" ? itemIconUrl(name, category) : classIconUrl(name);
  const sizeClass = size === "sm" ? "size-7" : size === "lg" ? "size-12" : "size-9";
  const Fallback = kind === "item" ? Package : Shield;
  return <span role="img" aria-label={`${kind === "item" ? "Предмет" : "Класс"}: ${name}`} className={`${sizeClass} relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-sm text-muted-foreground`}>
    <Fallback size={18} strokeWidth={1.5} aria-hidden="true" />
    {url && <span aria-hidden="true" className="absolute inset-0 bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url("${url}")` }} />}
  </span>;
}
