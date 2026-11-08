import type { InstanceOption } from "@/features/instances/catalog-schema";
import { CALENDAR_SCHEDULES } from "./calendar-schedules";
import { INSTANCE_LOCKOUT_FAMILIES } from "./instance-lockouts";
export function calendarInstanceName(instance: { code: string; displayName: string }) {
  if (instance.code === "FREYA_HARD") return "Фрея Блесс";
  return (
    CALENDAR_SCHEDULES.find((r) => r.code === instance.code)?.name ??
    INSTANCE_LOCKOUT_FAMILIES.find((f) => f.codes.includes(instance.code))?.label ??
    instance.displayName
  );
}
export function calendarVisibleInstances<T extends InstanceOption & { code: string }>(
  instances: T[],
): InstanceOption[] {
  const allowed = new Set([...CALENDAR_SCHEDULES.map((r) => r.code), "FREYA_HARD"]);
  return instances
    .filter((i) => allowed.has(i.code))
    .map((i) => ({ ...i, displayName: calendarInstanceName(i) }));
}
export function calendarTrackedIds(instances: { id: string; code: string }[]) {
  const codes = new Set([
    ...CALENDAR_SCHEDULES.map((r) => r.code),
    ...INSTANCE_LOCKOUT_FAMILIES.flatMap((f) => f.codes),
  ]);
  return new Set(instances.filter((i) => codes.has(i.code)).map((i) => i.id));
}
