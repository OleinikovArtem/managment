import { describe, expect, it } from "vitest";
import {
  localDateTimeToUtc,
  toLocalDateTimeInput,
} from "@/features/raids/local-date-time";

describe("raid local date-time conversion", () => {
  it("converts local time to UTC and back in the selected system time zone", () => {
    const previousTimezone = process.env.TZ;
    process.env.TZ = "Europe/Kiev";
    try {
      const localValue = "2026-11-01T20:30";
      const utcValue = localDateTimeToUtc(localValue);

      expect(utcValue).toBe("2026-11-01T18:30:00.000Z");
      expect(toLocalDateTimeInput(utcValue ?? "")).toBe(localValue);
    } finally {
      if (previousTimezone === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = previousTimezone;
      }
    }
  });

  it("rejects invalid local time values", () => {
    expect(localDateTimeToUtc("not-a-date")).toBeNull();
  });

  it("rejects skipped or repeated local times around daylight-saving changes", () => {
    const previousTimezone = process.env.TZ;
    process.env.TZ = "Europe/Kiev";
    try {
      expect(localDateTimeToUtc("2026-03-29T03:30")).toBeNull();
      expect(localDateTimeToUtc("2026-10-25T03:30")).toBeNull();
    } finally {
      if (previousTimezone === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = previousTimezone;
      }
    }
  });
});
