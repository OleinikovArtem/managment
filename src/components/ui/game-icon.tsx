import { Package, Shield } from "lucide-react";

const ITEM_ICON_BASE = "https://l2db.info/uploads/images/icons";
const CLASS_ICON_BASE = "https://l2revolution.fandom.com/wiki/Special:FilePath";

function itemIconKey(name: string, category?: string | null) {
  const value = name.toLocaleLowerCase();
  if (value.includes("life stone")) return "etc_mineral_i00";
  if (value.includes("crystal")) return "etc_crystal_i00";
  if (value.includes("scroll") || value.includes("enchant")) return value.includes("weapon") ? "etc_scroll_of_enchant_weapon_i00" : "etc_scroll_of_enchant_armor_i00";
  if (value.includes("book") || value.includes("codex") || value.includes("spellbook")) return "etc_spellbook_i00";
  if (category === "Armor" || /armor|breastplate|gaiters|boots|helmet|circlet|gloves|robe|stockings|shoes|tunic/i.test(name)) {
    if (/major arcana/i.test(name)) return "armor_t86_m_i00";
    if (/dynasty/i.test(name)) return "armor_t88_u_i00";
    if (/elegia/i.test(name)) return "armor_t91_u_i00";
    if (/vesper/i.test(name)) return "armor_t95_u_i00";
    if (/draconic/i.test(name)) return "armor_t86_l_i00";
    return "armor_t86_u_i00";
  }
  if (category === "Weapon" || /sword|blade|cutter|bow|axe|hammer|staff|mace|knife|dagger|splitter|edge|retributer|shaper|thrower/i.test(name)) {
    if (/bow/i.test(name)) return "weapon_bow_i00";
    if (/staff|mace/i.test(name)) return "weapon_staff_i00";
    if (/axe|hammer/i.test(name)) return "weapon_blunt_i00";
    if (/knife|dagger/i.test(name)) return "weapon_dagger_i00";
    return "weapon_sword_i00";
  }
  return "etc_jewel_i00";
}

export function itemIconUrl(name: string, category?: string | null) {
  return `${ITEM_ICON_BASE}/${itemIconKey(name, category)}.png`;
}

function classIconFile(className: string) {
  const value = className.toLocaleLowerCase();
  if (/cardinal/.test(value)) return "Bishop.png";
  if (/saint|elder/.test(value)) return "Elder.png";
  if (/sword muse/.test(value)) return "Swordsinger.png";
  if (/dancer/.test(value)) return "Bladedancer.png";
  if (/screamer|mystic muse|archmage|soultaker|arcana lord/.test(value)) return "Spellhowler.png";
  if (/sentinel|sagittarius|ranger|trickster/.test(value)) return "Silver Ranger.png";
  if (/dagger|hunter|wind rider|adventurer/.test(value)) return "Treasure Hunter.png";
  if (/tank|templar|knight|phoenix|hell knight/.test(value)) return "Temple Knight.png";
  if (/dreadnought|titan|duelist|khavatari|warrior/.test(value)) return "Warlord.png";
  if (/maestro|fortune seeker|scavenger/.test(value)) return "Scavenger.png";
  return "Sage.png";
}

export function classIconUrl(className: string) {
  return `${CLASS_ICON_BASE}/${encodeURIComponent(classIconFile(className))}`;
}

export function GameIcon({ kind, name, category, size = "md" }: { kind: "item" | "class"; name: string; category?: string | null; size?: "sm" | "md" | "lg" }) {
  const url = kind === "item" ? itemIconUrl(name, category) : classIconUrl(name);
  const sizeClass = size === "sm" ? "size-7" : size === "lg" ? "size-12" : "size-9";
  const Fallback = kind === "item" ? Package : Shield;
  return <span role="img" aria-label={`${kind === "item" ? "Предмет" : "Класс"}: ${name}`} className={`${sizeClass} relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-sm text-muted-foreground`}>
    <Fallback size={18} strokeWidth={1.5} aria-hidden="true" />
    <span aria-hidden="true" className="absolute inset-0 bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url("${url}")` }} />
  </span>;
}
