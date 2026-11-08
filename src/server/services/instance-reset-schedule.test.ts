import { describe, expect, it } from "vitest";
import { resetPeriod, wallTimeToUtc } from "./instance-reset-schedule";
import type { CalendarRuleData } from "@/features/calendar/calendar-schema";
const rule: CalendarRuleData = {
  id: "r",
  instanceId: "i",
  revision: 1,
  lockoutKey: "i",
  timezone: "Europe/Kyiv",
  type: "daily",
  localTime: "06:30",
  isoWeekdays: [],
  effectiveFrom: new Date("2026-01-01T00:00:00Z"),
};
describe("instance reset schedule", () => {
  it("uses exact half-open UTC periods at reset", () => {
    const before = resetPeriod(rule, new Date("2026-11-08T04:29:59Z"));
    const at = resetPeriod(rule, new Date("2026-11-08T04:30:00Z"));
    expect(before.end.toISOString()).toBe("2026-11-08T04:30:00.000Z");
    expect(at.start.toISOString()).toBe(before.end.toISOString());
    expect(at.end.toISOString()).toBe("2026-11-09T04:30:00.000Z");
  });
  it("handles weekly multiple weekdays and year boundaries", () => {
    const period = resetPeriod(
      { ...rule, type: "weekly", isoWeekdays: [1, 4] },
      new Date("2026-12-31T08:00:00Z"),
    );
    expect(period.start.toISOString()).toBe("2026-12-31T04:30:00.000Z");
    expect(period.end.toISOString()).toBe("2027-01-04T04:30:00.000Z");
  });
  it("keeps local reset time across DST instead of adding 24 UTC hours", () => {
    const period = resetPeriod(rule, new Date("2026-03-28T08:00:00Z"));
    expect(period.start.toISOString()).toBe("2026-03-28T04:30:00.000Z");
    expect(period.end.toISOString()).toBe("2026-03-29T03:30:00.000Z");
  });
  it("rejects nonexistent or ambiguous wall times", () => {
    expect(() => wallTimeToUtc("2026-03-29T03:30", "Europe/Kyiv")).toThrow(/неоднозначно/);
    expect(() => wallTimeToUtc("2026-10-25T03:30", "Europe/Kyiv")).toThrow(/неоднозначно/);
  });
  it("rejects unsupported rules and dates before effectiveFrom", () => {
    expect(() => resetPeriod({ ...rule, type: "elapsed" }, new Date())).toThrow();
    expect(() => resetPeriod(rule, new Date("2025-12-31T00:00:00Z"))).toThrow(/нет действующего/);
  });
});
