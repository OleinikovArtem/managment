import { LINEAGE2_HIGH_FIVE_CLASSES } from "@/features/members/lineage2-classes";

export type ProfessionProfile = {
  id: string;
  className: string;
  subclassSlot?: number | null;
  name?: string;
};

export type ProfessionOption = {
  value: string;
  className: string;
  source: "main" | "subclass" | "catalog" | "legacy";
  label: string;
  profileId?: string;
};

function normalizeClassName(value: string) {
  return value.trim().toLocaleLowerCase();
}

export function buildProfessionOptions(
  mainClass: string | null | undefined,
  profiles: ProfessionProfile[],
  preserved?: { profileId?: string; className: string } | null,
): ProfessionOption[] {
  const options: ProfessionOption[] = [];
  const seen = new Set<string>();
  const add = (option: ProfessionOption) => {
    const normalized = normalizeClassName(option.className);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    options.push(option);
  };

  if (mainClass?.trim()) {
    add({ value: "main", className: mainClass.trim(), source: "main", label: "Main" });
  }

  const orderedProfiles = [...profiles].sort((a, b) => {
    const slotA = a.subclassSlot ?? Number.MAX_SAFE_INTEGER;
    const slotB = b.subclassSlot ?? Number.MAX_SAFE_INTEGER;
    return slotA - slotB || a.id.localeCompare(b.id);
  });
  for (const profile of orderedProfiles) {
    add({
      value: `profile:${profile.id}`,
      className: profile.className.trim(),
      source: "subclass",
      label: profile.subclassSlot ? `Subclass ${profile.subclassSlot}` : profile.name || "Профиль",
      profileId: profile.id,
    });
  }

  if (preserved?.className.trim()) {
    const value = preserved.profileId
      ? `profile:${preserved.profileId}`
      : `class:${preserved.className}`;
    if (!options.some((option) => option.value === value)) {
      add({
        value,
        className: preserved.className.trim(),
        source: "legacy",
        label: preserved.profileId ? "Сохранённый профиль" : "Сохранённый выбор",
        profileId: preserved.profileId,
      });
    }
  }

  const remaining = LINEAGE2_HIGH_FIVE_CLASSES.filter(
    (className) => !seen.has(normalizeClassName(className)),
  ).sort((a, b) => a.localeCompare(b));
  for (const className of remaining) {
    add({ value: `class:${className}`, className, source: "catalog", label: "Каталог" });
  }
  return options;
}

export function resolveSelectedProfessionOption(
  options: ProfessionOption[],
  value: string | undefined,
  preserved?: { profileId?: string; className: string } | null,
) {
  const direct = options.find((option) => option.value === value);
  if (direct || !value || !preserved?.className.trim()) return direct ?? null;
  const preservedValue = preserved.profileId
    ? `profile:${preserved.profileId}`
    : `class:${preserved.className}`;
  if (value !== preservedValue) return null;
  return (
    options.find(
      (option) => normalizeClassName(option.className) === normalizeClassName(preserved.className),
    ) ?? null
  );
}

export function filterProfessionOptions(options: ProfessionOption[], query: string) {
  const normalizedQuery = normalizeClassName(query);
  return normalizedQuery
    ? options.filter((option) => normalizeClassName(option.className).includes(normalizedQuery))
    : options;
}
