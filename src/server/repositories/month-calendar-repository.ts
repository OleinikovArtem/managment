import "server-only";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  calendarDate,
  calendarMonth,
  monthDates,
  addCalendarDays,
  type MonthCalendarData,
} from "@/features/calendar/month-calendar-model";
import {
  activeCalendarRule,
  calendarRaidEvents,
  calendarResetEvents,
  calendarWarnings,
} from "@/server/services/month-calendar-service";
import { resetPeriod, wallTimeToUtc } from "@/server/services/instance-reset-schedule";
import { expandFamilyRules } from "@/features/calendar/instance-lockouts";
import {
  calendarVisibleInstances,
  calendarTrackedIds,
  calendarInstanceName,
} from "@/features/calendar/calendar-instance-options";
import { serverCalendarRules } from "@/features/calendar/calendar-schedules";

export async function readMonthCalendar(
  partyId: string,
  requestedMonth: unknown,
  now = new Date(),
): Promise<Omit<MonthCalendarData, "canManage">> {
  const month = calendarMonth(requestedMonth, now),
    days = monthDates(month);
  const start = wallTimeToUtc(`${days[0]}T00:00`, "Europe/Kyiv");
  const end = wallTimeToUtc(`${addCalendarDays(days.at(-1)!, 1)}T00:00`, "Europe/Kyiv");
  return prisma.$transaction(
    async (tx) => {
      const [members, instances] = await Promise.all([
        tx.partyMember.findMany({
          where: { partyId, isActive: true },
          select: { id: true, nickname: true },
          orderBy: { nickname: "asc" },
        }),
        tx.instance.findMany({
          where: { OR: [{ partyId: null }, { partyId }] },
          orderBy: { displayName: "asc" },
        }),
      ]);
      const tracked = calendarTrackedIds(instances),
        rules = expandFamilyRules(serverCalendarRules(instances), instances);
      let currentStart = now;
      for (const id of new Set(rules.map((r) => r.instanceId))) {
        const rule = activeCalendarRule(rules, id, now);
        if (rule) {
          try {
            const period = resetPeriod(rule, now);
            if (period.start < currentStart) currentStart = period.start;
          } catch {
            /* Unknown schedules have no inferred deadline. */
          }
        }
      }
      const raids = await tx.raid.findMany({
        where: {
          partyId,
          AND: [{ OR: [{ instanceId: null }, { instanceId: { in: [...tracked] } }] }],
          OR: [
            { occurredAt: { gte: start, lt: end, lte: now } },
            { occurredAt: { gte: currentStart, lte: now } },
          ],
        },
        select: {
          id: true,
          instanceId: true,
          instanceName: true,
          name: true,
          occurredAt: true,
          participants: { select: { memberId: true, nicknameSnapshot: true, status: true } },
        },
        orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
      });
      const names = new Map(instances.map((i) => [i.id, calendarInstanceName(i)]));
      const resets = calendarResetEvents(rules, days, names);
      const { warnings, nextUpdateAt } = calendarWarnings(rules, raids, members, names, now);
      return {
        month,
        today: calendarDate(now),
        serverNow: now.toISOString(),
        days,
        events: [...resets.events, ...calendarRaidEvents(raids, names, days, now)].sort(
          (a, b) =>
            a.occurredAt.localeCompare(b.occurredAt) ||
            a.kind.localeCompare(b.kind) ||
            a.name.localeCompare(b.name, "ru"),
        ),
        warnings,
        nextUpdateAt,
        members,
        instanceOptions: calendarVisibleInstances(instances),
        ruleErrors: resets.errors,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 15000 },
  );
}
