// Schedule supplied by the party owner; these are server-specific rules, not H5 defaults.
export const CALENDAR_SCHEDULES = [
  { code: "FORTRESS_DUNGEON", name: "Подвал", days: [] as number[], key: "FORTRESS_DUNGEON" },
  { code: "LAB_78", name: "Лаба", days: [3, 6], key: "FAMILY_LAB" },
  { code: "ZAKEN_DAY", name: "Закен", days: [1, 5], key: "FAMILY_ZAKEN" },
  { code: "TWINS", name: "Близы", days: [1, 5], key: "TWINS" },
  { code: "TIAT", name: "Тиата", days: [1, 5], key: "TIAT" },
  { code: "FREYA_NORMAL", name: "Фрея", days: [3, 6], key: "FAMILY_FREYA" },
];
export const RESET_TIME = "06:30";
export const RESET_TIMEZONE = "Europe/Kyiv";

export function serverCalendarRules(instances: { id: string; code: string }[]) {
  return CALENDAR_SCHEDULES.flatMap((schedule) => {
    const instance = instances.find((i) => i.code === schedule.code);
    return instance
      ? [
          {
            id: `server:${schedule.key}`,
            instanceId: instance.id,
            revision: 1,
            lockoutKey: schedule.key,
            lockoutLabel: schedule.name,
            timezone: RESET_TIMEZONE,
            type: schedule.days.length ? "weekly" : "daily",
            localTime: RESET_TIME,
            isoWeekdays: schedule.days,
            effectiveFrom: new Date("1900-01-01T00:00:00Z"),
          },
        ]
      : [];
  });
}
