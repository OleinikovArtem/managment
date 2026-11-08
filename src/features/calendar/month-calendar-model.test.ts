import { describe, expect, it } from "vitest";
import {
  calendarDate,
  calendarMonth,
  monthDates,
  shiftCalendarMonth,
  filterMonthEvents,
} from "./month-calendar-model";
describe("month calendar dates", () => {
  it("renders complete Monday–Sunday weeks across years and leap February", () => {
    const november = monthDates("2026-11");
    expect(november).toHaveLength(42);
    expect(november[0]).toBe("2026-10-26");
    expect(november.at(-1)).toBe("2026-12-06");
    expect(monthDates("2024-02")).toContain("2024-02-29");
    expect(monthDates("2023-02")).not.toContain("2023-02-29");
    expect(shiftCalendarMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftCalendarMonth("2026-01", -1)).toBe("2025-12");
  });
  it("uses Kyiv dates rather than the viewer timezone and rejects malformed months", () => {
    expect(calendarDate("2026-01-15T23:30:00Z")).toBe("2026-01-16");
    expect(calendarMonth("2026-13", new Date("2026-11-08T12:00:00Z"))).toBe("2026-11");
  });
  it("keeps a shared reset when filtering any of its variants", () => {
    const event = {
      id: "reset",
      kind: "reset" as const,
      date: "2026-11-08",
      occurredAt: "2026-11-08T04:30:00Z",
      instanceId: "lab78",
      instanceIds: ["lab78", "lab83"],
      name: "Лабы",
      participants: [],
    };
    expect(filterMonthEvents([event], "lab83", "hero")).toEqual([event]);
    expect(filterMonthEvents([event], "zaken", "")).toHaveLength(0);
  });
});
