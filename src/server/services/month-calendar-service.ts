import type { CalendarRuleData } from "@/features/calendar/calendar-schema";
import {
  addCalendarDays,
  calendarDate,
  type MonthEvent,
  type CalendarWarning,
} from "@/features/calendar/month-calendar-model";
import { resetPeriod, wallTimeToUtc } from "./instance-reset-schedule";

export type CalendarRaid = {
  id: string;
  instanceId: string | null;
  instanceName: string | null;
  name: string;
  occurredAt: Date;
  participants: { memberId: string; nicknameSnapshot: string; status: string }[];
};
export function activeCalendarRule(rules: CalendarRuleData[], instanceId: string, at: Date) {
  return rules
    .filter((r) => r.instanceId === instanceId && r.effectiveFrom <= at)
    .sort(
      (a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime() || b.revision - a.revision,
    )[0];
}
export function calendarResetEvents(
  rules: CalendarRuleData[],
  days: string[],
  names: Map<string, string>,
) {
  const events: MonthEvent[] = [];
  const errors = new Set<string>();
  const seen = new Set<string>();
  const from = days[0],
    until = days.at(-1)!;
  for (
    let day = addCalendarDays(from, -1);
    day <= addCalendarDays(until, 1);
    day = addCalendarDays(day, 1)
  ) {
    for (const rule of rules) {
      if (!["daily", "weekly"].includes(rule.type)) {
        errors.add(names.get(rule.instanceId) ?? "Инстанс");
        continue;
      }
      if (
        rule.type === "weekly" &&
        !rule.isoWeekdays.includes(new Date(`${day}T12:00:00Z`).getUTCDay() || 7)
      )
        continue;
      try {
        const at = wallTimeToUtc(`${day}T${rule.localTime}`, rule.timezone);
        if (activeCalendarRule(rules, rule.instanceId, at)?.id !== rule.id) continue;
        const date = calendarDate(at);
        if (date < from || date > until) continue;
        const key = `${rule.lockoutKey}:${at.toISOString()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        events.push({
          id: `reset:${key}`,
          kind: "reset",
          date,
          occurredAt: at.toISOString(),
          instanceId: rule.instanceId,
          instanceIds: [
            ...new Set(
              rules
                .filter(
                  (r) =>
                    activeCalendarRule(rules, r.instanceId, at)?.lockoutKey === rule.lockoutKey,
                )
                .map((r) => r.instanceId),
            ),
          ],
          name: rule.lockoutLabel ?? names.get(rule.instanceId) ?? "Инстанс",
          participants: [],
        });
      } catch {
        errors.add(names.get(rule.instanceId) ?? "Инстанс");
      }
    }
  }
  return { events, errors: [...errors] };
}
export function calendarRaidEvents(
  raids: CalendarRaid[],
  names: Map<string, string>,
  days: string[],
  now: Date,
): MonthEvent[] {
  return raids
    .filter((r) => r.occurredAt <= now)
    .map((r) => ({
      id: `raid:${r.id}`,
      kind: "raid" as const,
      date: calendarDate(r.occurredAt),
      occurredAt: r.occurredAt.toISOString(),
      instanceId: r.instanceId,
      name: (r.instanceId && names.get(r.instanceId)) || r.instanceName || r.name,
      raidId: r.id,
      unknownInstance: !r.instanceId,
      participants: r.participants
        .filter((p) => p.status === "PRESENT")
        .map((p) => ({ memberId: p.memberId, nickname: p.nicknameSnapshot })),
    }))
    .filter((e) => e.date >= days[0] && e.date <= days.at(-1)!);
}
export function calendarWarnings(
  rules: CalendarRuleData[],
  raids: CalendarRaid[],
  members: { id: string; nickname: string }[],
  names: Map<string, string>,
  now: Date,
) {
  const warnings: CalendarWarning[] = [];
  const updates: number[] = [];
  const seen = new Set<string>();
  for (const id of new Set(rules.map((r) => r.instanceId))) {
    const rule = activeCalendarRule(rules, id, now);
    if (!rule || rule.type === "daily") continue;
    if (seen.has(rule.lockoutKey)) continue;
    seen.add(rule.lockoutKey);
    try {
      const period = resetPeriod(rule, now);
      const opening = period.end.getTime() - 86400000;
      updates.push(period.end.getTime());
      if (opening > now.getTime()) updates.push(opening);
      if (now.getTime() < opening) continue;
      const sharedIds = new Set(
        rules
          .filter(
            (r) => activeCalendarRule(rules, r.instanceId, now)?.lockoutKey === rule.lockoutKey,
          )
          .map((r) => r.instanceId),
      );
      const present = new Set(
        raids
          .filter(
            (r) =>
              r.instanceId &&
              sharedIds.has(r.instanceId) &&
              r.occurredAt >= period.start &&
              r.occurredAt < period.end &&
              r.occurredAt <= now,
          )
          .flatMap((r) =>
            r.participants.filter((p) => p.status === "PRESENT").map((p) => p.memberId),
          ),
      );
      const missing = members
        .filter((m) => !present.has(m.id))
        .map((m) => ({ memberId: m.id, nickname: m.nickname }));
      if (missing.length)
        warnings.push({
          instanceId: id,
          name: rule.lockoutLabel ?? names.get(id) ?? "Инстанс",
          deadline: period.end.toISOString(),
          missing,
        });
    } catch {
      /* An invalid rule is shown separately, without an invented deadline. */
    }
  }
  for (const rule of rules)
    if (rule.effectiveFrom > now) updates.push(rule.effectiveFrom.getTime());
  warnings.sort(
    (a, b) => a.deadline.localeCompare(b.deadline) || a.name.localeCompare(b.name, "ru"),
  );
  return {
    warnings,
    nextUpdateAt: updates.length ? new Date(Math.min(...updates)).toISOString() : null,
  };
}
