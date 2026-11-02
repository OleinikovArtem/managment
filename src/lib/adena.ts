const MAX_SQLITE_BIGINT = 9223372036854775807n;

const SUFFIXES = new Map([
  ["k", 1_000n],
  ["к", 1_000n],
  ["m", 1_000_000n],
  ["м", 1_000_000n],
  ["b", 1_000_000_000n],
  ["б", 1_000_000_000n],
]);

/** Converts a user-friendly value such as `5.25м` to an exact Adena integer string. */
export function parseAdenaInput(value: string): string | null {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "").replace(",", ".");
  if (!normalized) return null;
  const suffix = normalized.slice(-1);
  const multiplier = SUFFIXES.get(suffix) ?? 1n;
  const numberPart = SUFFIXES.has(suffix) ? normalized.slice(0, -1) : normalized;
  if (!/^\d+(?:\.\d+)?$/.test(numberPart)) return null;
  if (!SUFFIXES.has(suffix) && !/^[1-9]\d*$/.test(numberPart)) return null;
  const [whole, fraction = ""] = numberPart.split(".");
  const scale = 10n ** BigInt(fraction.length);
  const scaled = BigInt(whole) * scale + BigInt(fraction || "0");
  const scaledResult = scaled * multiplier;
  const result = scaledResult / scale;
  if (result <= 0n || result > MAX_SQLITE_BIGINT || scaledResult % scale !== 0n) return null;
  return result.toString();
}

export function formatAdena(value: bigint | string): string {
  const amount = typeof value === "bigint" ? value : BigInt(value);
  const absolute = amount < 0n ? -amount : amount;
  const sign = amount < 0n ? "-" : "";
  const units: [bigint, string][] = [
    [1_000_000_000_000n, "трлн"],
    [1_000_000_000n, "млрд"],
    [1_000_000n, "м"],
    [1_000n, "к"],
  ];
  for (const [unit, label] of units) {
    if (absolute >= unit) {
      const scaled = Number(absolute / (unit / 100n)) / 100;
      return `${sign}${scaled.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")}${label}`;
    }
  }
  return `${sign}${absolute.toLocaleString("ru-RU")} Adena`;
}

export function adenaColor(value: bigint | string): string {
  void value;
  return "hsl(45 92% 56%)";
}
