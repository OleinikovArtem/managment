import { describe, expect, it } from "vitest";
import { expandFamilyRules } from "@/features/calendar/instance-lockouts";
import { monthDates } from "@/features/calendar/month-calendar-model";
import type { CalendarRuleData } from "@/features/calendar/calendar-schema";
import {
  calendarWarnings,
  calendarResetEvents,
  calendarRaidEvents,
  type CalendarRaid,
} from "./month-calendar-service";
const rule: CalendarRuleData = {
  id: "r",
  instanceId: "FREYA_NORMAL",
  revision: 1,
  lockoutKey: "freya",
  timezone: "Europe/Kyiv",
  type: "weekly",
  localTime: "06:30",
  isoWeekdays: [3, 6],
  effectiveFrom: new Date("2020-01-01Z"),
};
const members = [
  { id: "hero0", nickname: "Current0" },
  { id: "hero1", nickname: "Current1" },
];
const names = new Map([
  ["FREYA_NORMAL", "Фрея"],
  ["FREYA_HARD", "Фрея Б"],
]);
const raid: CalendarRaid = {
  id: "raid",
  instanceId: "FREYA_HARD",
  instanceName: null,
  name: "Raid",
  occurredAt: new Date("2026-11-08T12:00:00Z"),
  participants: [
    { memberId: "hero0", nicknameSnapshot: "Historical0", status: "PRESENT" },
    { memberId: "hero1", nicknameSnapshot: "Historical1", status: "ABSENT" },
  ],
};
describe("monthly party activity projection", () => {
  it("excludes daily resets from warnings while preserving their calendar events", () => {
    const daily = { ...rule, instanceId: "podval", type: "daily", isoWeekdays: [] };
    const result = calendarWarnings([daily], [], members, names, new Date("2026-11-10T12:00:00Z"));
    expect(result.warnings).toEqual([]);
    expect(result.nextUpdateAt).toBeNull();
    expect(calendarResetEvents([daily], monthDates("2026-11"), names).events).toHaveLength(42);
  });
  it("warns exactly in [reset−24h, reset) and uses actual elapsed hours across DST", () => {
    expect(
      calendarWarnings([rule], [], members, names, new Date("2026-11-10T04:29:59Z")).warnings,
    ).toHaveLength(0);
    expect(
      calendarWarnings([rule], [], members, names, new Date("2026-11-10T04:30:00Z")).warnings,
    ).toHaveLength(1);
    expect(
      calendarWarnings([rule], [], members, names, new Date("2026-11-11T04:30:00Z")).warnings,
    ).toHaveLength(0);
    const dst = { ...rule, isoWeekdays: [7] };
    expect(
      calendarWarnings([dst], [], members, names, new Date("2026-03-28T03:29:59Z")).warnings,
    ).toHaveLength(0);
    expect(
      calendarWarnings([dst], [], members, names, new Date("2026-03-28T03:30:00Z")).warnings,
    ).toHaveLength(1);
  });
  it("shares Freya eligibility across modes and emits one warning/reset for the family", () => {
    const rules = expandFamilyRules(
      [rule],
      [
        { id: "FREYA_NORMAL", code: "FREYA_NORMAL" },
        { id: "FREYA_HARD", code: "FREYA_HARD" },
      ],
    );
    const result = calendarWarnings(
      rules,
      [raid],
      members,
      names,
      new Date("2026-11-10T12:00:00Z"),
    );
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].name).toBe("Фрея");
    expect(result.warnings[0].missing.map((m) => m.memberId)).toEqual(["hero1"]);
    const events = calendarResetEvents(rules, monthDates("2026-11"), names).events.filter(
      (e) => e.date === "2026-11-11",
    );
    expect(events).toHaveLength(1);
    expect(events[0].instanceIds).toEqual(["FREYA_NORMAL", "FREYA_HARD"]);
  });
  it("shares all lab levels and Zaken modes without sharing unrelated families", () => {
    const instances = ["LAB_78", "LAB_81", "LAB_83", "ZAKEN_DAY", "ZAKEN_NIGHT", "ZAKEN_83"].map(
      (code) => ({ id: code, code }),
    );
    const rules = expandFamilyRules(
      [
        { ...rule, instanceId: "LAB_78" },
        { ...rule, id: "z", instanceId: "ZAKEN_DAY" },
      ],
      instances,
    );
    const labRaid = { ...raid, instanceId: "LAB_83", occurredAt: new Date("2026-11-10T08:00:00Z") };
    const result = calendarWarnings(
      rules,
      [labRaid],
      members,
      new Map(),
      new Date("2026-11-10T12:00:00Z"),
    );
    expect(result.warnings.find((w) => w.name === "Лаба")?.missing.map((m) => m.memberId)).toEqual([
      "hero1",
    ]);
    expect(result.warnings.find((w) => w.name === "Закен")?.missing).toHaveLength(2);
  });
  it("uses original PRESENT snapshots, preserves separate raids and excludes future records", () => {
    const events = calendarRaidEvents(
      [
        raid,
        { ...raid, id: "second" },
        { ...raid, id: "future", occurredAt: new Date("2027-01-01Z") },
      ],
      names,
      monthDates("2026-11"),
      new Date("2026-11-10Z"),
    );
    expect(events).toHaveLength(2);
    expect(events[0].name).toBe("Фрея Б");
    expect(events[0].participants).toEqual([{ memberId: "hero0", nickname: "Historical0" }]);
  });
  it("does not count earlier periods, ABSENT, unknown instances or future raids", () => {
    const rules = expandFamilyRules(
      [rule],
      [
        { id: "FREYA_NORMAL", code: "FREYA_NORMAL" },
        { id: "FREYA_HARD", code: "FREYA_HARD" },
      ],
    );
    const variants = [
      { ...raid, occurredAt: new Date("2026-11-06Z") },
      { ...raid, instanceId: null },
      { ...raid, occurredAt: new Date("2026-11-10T23:00:00Z") },
    ];
    expect(
      calendarWarnings(rules, variants, members, names, new Date("2026-11-10T12:00:00Z"))
        .warnings[0].missing,
    ).toHaveLength(2);
    expect(
      calendarWarnings(
        rules,
        [
          {
            ...raid,
            participants: members.map((m) => ({
              memberId: m.id,
              nicknameSnapshot: m.nickname,
              status: "PRESENT",
            })),
          },
        ],
        members,
        names,
        new Date("2026-11-10T12:00:00Z"),
      ).warnings,
    ).toHaveLength(0);
  });
  it("uses historical rule revisions and reports unsupported DST schedule times", () => {
    const next = {
      ...rule,
      id: "new",
      revision: 2,
      effectiveFrom: new Date("2026-11-10Z"),
      isoWeekdays: [1],
    };
    const events = calendarResetEvents([rule, next], monthDates("2026-11"), names).events;
    expect(events.some((e) => e.date === "2026-11-07")).toBe(true);
    expect(events.some((e) => e.date === "2026-11-11")).toBe(false);
    expect(events.some((e) => e.date === "2026-11-16")).toBe(true);
    const invalid = { ...rule, type: "daily", localTime: "03:30" };
    expect(calendarResetEvents([invalid], monthDates("2026-03"), names).errors).toContain("Фрея");
  });
});
