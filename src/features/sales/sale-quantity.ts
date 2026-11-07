export function clampSaleQuantity(value: string, maximum: number): string {
  if (!value) return "";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "";
  return String(Math.min(maximum, Math.max(1, Math.floor(parsed))));
}
