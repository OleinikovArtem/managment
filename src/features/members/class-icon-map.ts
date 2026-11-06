import { LINEAGE2_HIGH_FIVE_CLASSES } from "./lineage2-classes";

// User-provided symbols; both Soul Hound variants share one icon. Inspector
// uses the supplied symbol for its Judicator profession branch.
const aliases: Record<string, string> = {
  "Male Soul Hound": "soul-hound", "Female Soul Hound": "soul-hound", Inspector: "judicator",
};
export const LOCAL_CLASS_ICONS: Readonly<Record<string, string>> = Object.fromEntries(
  LINEAGE2_HIGH_FIVE_CLASSES.map(name => [name.toLowerCase(), `/game-icons/classes/${aliases[name] ?? name.toLowerCase().replace(/'/g, "").replace(/\s+/g, "-")}.png`]),
);
