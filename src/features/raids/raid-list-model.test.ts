import { describe, expect, it } from "vitest";
import {
  getRaidPeriod,
  groupRaids,
  paginateRaidGroups,
  type RaidListRow,
} from "@/features/raids/raid-list-model";

const now = new Date(2026, 10, 7, 12);
function raid(id: string, day: number, month = 10): RaidListRow {
  return {
    id,
    name: id,
    instanceName: "Instance",
    occurredAt: new Date(2026, month, day, 19).toISOString(),
    present: 9,
    drops: 2,
  };
}

describe("raid date groups", () => {
  it("assigns exclusive local-calendar periods", () => {
    expect(getRaidPeriod(raid("today", 7).occurredAt, now)).toBe("today");
    expect(getRaidPeriod(raid("yesterday", 6).occurredAt, now)).toBe("yesterday");
    expect(getRaidPeriod(raid("week", 1).occurredAt, now)).toBe("week");
    expect(getRaidPeriod(raid("month", 15, 9).occurredAt, now)).toBe("month");
    expect(getRaidPeriod(raid("future", 8).occurredAt, now)).toBe("upcoming");
  });

  it("uses the selected timezone when a raid falls near local midnight", () => {
    expect(
      getRaidPeriod("2026-11-06T23:00:00.000Z", new Date("2026-11-07T01:00:00.000Z"), "America/Los_Angeles"),
    ).toBe("today");
  });

  it("groups old raids by month and sorts groups and entries newest first", () => {
    const groups = groupRaids(
      [
        raid("september", 30, 8),
        raid("new", 7),
        raid("october", 1, 9),
        raid("week", 1),
        raid("yesterday", 6),
      ],
      now,
    );
    expect(groups.map(({ label }) => label)).toEqual([
      "Сегодня",
      "Вчера",
      "Последние 7 дней",
      "Октября 2026",
      "Сентября 2026",
    ]);
    expect(groups.flatMap(({ raids: items }) => items.map(({ id }) => id))).toEqual([
      "new",
      "yesterday",
      "week",
      "october",
      "september",
    ]);
  });

  it("keeps date groups together across pages unless one group exceeds the page size", () => {
    const groups = groupRaids(
      [raid("today-1", 7), raid("today-2", 7), raid("yesterday-1", 6), raid("week-1", 1)],
      now,
    );
    const pages = paginateRaidGroups(groups, 2);
    expect(pages.map((page) => page.map(({ label }) => label))).toEqual([
      ["Сегодня"],
      ["Вчера", "Последние 7 дней"],
    ]);

    const oversized = groupRaids(
      Array.from({ length: 5 }, (_, index) => raid(`today-${index}`, 7)),
      now,
    );
    expect(paginateRaidGroups(oversized, 2).map((page) => page[0].raids.length)).toEqual([2, 2, 1]);
  });
});
