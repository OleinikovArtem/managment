import type { CalendarRuleData } from "./calendar-schema";

export const INSTANCE_LOCKOUT_FAMILIES = [
  { key: "FAMILY_LAB", label: "Лаба", codes: ["LAB_78", "LAB_81", "LAB_83"] },
  { key: "FAMILY_ZAKEN", label: "Закен", codes: ["ZAKEN_DAY", "ZAKEN_83"] },
  { key: "FAMILY_FREYA", label: "Фрея", codes: ["FREYA_NORMAL", "FREYA_HARD"] },
];
// Project legacy variant rules into one family schedule without rewriting history.
// The first configured code in the declared order supplies the family's revisions.
export function expandFamilyRules(
  rules: CalendarRuleData[],
  instances: { id: string; code: string }[],
): CalendarRuleData[] {
  const familyIds = new Set<string>();
  const expanded: CalendarRuleData[] = [];
  for (const family of INSTANCE_LOCKOUT_FAMILIES) {
    const variants = family.codes.flatMap((code) => instances.filter((i) => i.code === code));
    for (const variant of variants) familyIds.add(variant.id);
    const source = variants.find((i) => rules.some((r) => r.instanceId === i.id));
    if (!source) continue;
    for (const rule of rules.filter((r) => r.instanceId === source.id))
      for (const variant of variants)
        expanded.push({
          ...rule,
          instanceId: variant.id,
          lockoutKey: family.key,
          lockoutLabel: family.label,
        });
  }
  return [...rules.filter((r) => !familyIds.has(r.instanceId)), ...expanded];
}
