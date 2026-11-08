import { randomUUID } from "node:crypto";
import { test, expect } from "./local-fixtures";
import { calendarDate, dayTitle, monthDates } from "../src/features/calendar/month-calendar-model";

test.use({ timezoneId: "Europe/Kyiv" });

async function selectDay(page: import("@playwright/test").Page, day: string) {
  await page.locator(`button[data-date="${day}"]`).click();
  return page.getByRole("dialog", { name: dayTitle(day), exact: true });
}
async function setRaid(
  local: { db: import("pg").Pool; partyId: string },
  raidId: string,
  code: string,
  date: string,
) {
  const instance = (
    await local.db.query('SELECT id FROM "Instance" WHERE code=$1 AND "partyId" IS NULL', [code])
  ).rows[0];
  await local.db.query(
    'UPDATE "Raid" SET "instanceId"=$1,"occurredAt"=$2::timestamptz AT TIME ZONE \'UTC\' WHERE id=$3 AND "partyId"=$4',
    [instance.id, date, raidId, local.partyId],
  );
}

test("month grid opens historical party raids with original PRESENT names in Kyiv dates", async ({
  page,
  local,
  browser,
}, testInfo) => {
  const raid = await local.addRaid();
  await setRaid(local, raid, "LAB_83", "2026-01-15T23:30:00Z");
  await local.db.query(
    'UPDATE "RaidParticipant" SET "nicknameSnapshot"=\'HistoricalHero\' WHERE "raidId"=$1 AND "memberId"=$2',
    [raid, `${local.partyId}-member-0`],
  );
  await local.db.query(
    'UPDATE "RaidParticipant" SET status=\'ABSENT\' WHERE "raidId"=$1 AND "memberId"=$2',
    [raid, `${local.partyId}-member-1`],
  );
  await local.db.query(
    "UPDATE \"PartyMember\" SET nickname='RenamedHero',\"normalizedNickname\"='renamedhero' WHERE id=$1",
    [`${local.partyId}-member-0`],
  );
  const second = await local.addRaid();
  await setRaid(local, second, "FREYA_HARD", "2026-01-16T00:15:00Z");
  const elsewhere = await local.addRaid();
  await setRaid(local, elsewhere, "LAB_78", "2026-01-17T10:00:00Z");
  const otherContext = await browser.newContext({
    storageState: await page.context().storageState(),
    timezoneId: "America/Los_Angeles",
  });
  const view = await otherContext.newPage();
  try {
    await view.goto("/calendar?month=2026-01");
    await expect(view.getByRole("grid")).toBeVisible();
    await expect(view.getByRole("columnheader")).toHaveText([
      "Пн",
      "Вт",
      "Ср",
      "Чт",
      "Пт",
      "Сб",
      "Вс",
    ]);
    const panel = await selectDay(view, "2026-01-16");
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("link", { name: "Лаба ↗", exact: true })).toHaveAttribute(
      "href",
      new RegExp(`^/raids/${raid}\\?returnTo=`),
    );
    await expect(panel.getByRole("link", { name: "Фрея Блесс ↗", exact: true })).toHaveAttribute(
      "href",
      new RegExp(`^/raids/${second}\\?returnTo=`),
    );
    const lab = panel.getByRole("list", { name: "Участники: Лаба", exact: true });
    await expect(lab).toHaveText("HistoricalHero");
    await expect(lab.getByText("Hero1", { exact: true })).toHaveCount(0);
    await expect(panel.getByText("01:30", { exact: true })).toBeVisible();
    await expect(panel.getByRole("link", { name: "Лаба ↗" })).toHaveCount(1);
    await panel.getByRole("link", { name: "Лаба ↗", exact: true }).click();
    await expect(view.getByRole("heading", { level: 1 })).toBeVisible();
    await view.locator("#main-content").getByRole("link", { name: "Походы", exact: true }).click();
    await expect(view).toHaveURL(/\/raids\?.*month=2026-01.*view=calendar/);
    expect(new URL(view.url()).searchParams.get("day")).toBe("2026-01-16");
    await expect(view.getByRole("dialog", { name: dayTitle("2026-01-16"), exact: true })).toBeVisible();
    await view.reload();
    await expect(
      view.getByRole("dialog", { name: dayTitle("2026-01-16"), exact: true }),
    ).toBeVisible();
    await view.keyboard.press("Escape");
    await expect(view.getByRole("dialog")).toHaveCount(0);
    await view.setViewportSize({ width: 1440, height: 900 });
    await view.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    await view.screenshot({
      path: testInfo.outputPath("calendar-month-desktop.png"),
      fullPage: true,
    });
    expect(
      (
        await local.db.query(
          'SELECT "nicknameSnapshot",status FROM "RaidParticipant" WHERE "raidId"=$1 ORDER BY "memberId"',
          [raid],
        )
      ).rows,
    ).toHaveLength(2);
  } finally {
    await otherContext.close();
  }
});

test("month navigation, dense days, future details and keyboard preserve URL state", async ({
  page,
  local,
}, testInfo) => {
  for (let i = 0; i < 5; i++) {
    const id = await local.addRaid();
    await setRaid(local, id, "LAB_78", "2026-01-07T10:00:00Z");
  }
  const singleRaid = await local.addRaid();
  await setRaid(local, singleRaid, "LAB_78", "2026-01-08T10:00:00Z");
  const blessRaid = await local.addRaid();
  await setRaid(local, blessRaid, "FREYA_HARD", "2026-01-14T10:00:00Z");
  await page.goto("/calendar?month=2026-01");
  const cell = page.locator('button[data-date="2026-01-07"]');
  await page.getByRole("button", { name: "Показывать откаты", exact: true }).click();
  await expect(cell.locator("[title]")).toHaveCount(3);
  await expect(cell.locator("[title]")).toHaveText(Array(3).fill("● Поход · Лаба"));
  await expect(cell.getByText("Ещё 4", { exact: true })).toBeVisible();
  const blessDay = page.locator('button[data-date="2026-01-14"]');
  await expect(blessDay.locator("[title]")).toHaveText([
    "● Поход · Фрея Блесс",
    "↻ Откат · Лаба",
    "↻ Откат · Подвал",
  ]);
  await expect(blessDay.locator('[title="Откат: Фрея"]')).toHaveCount(0);
  const mixedDay = page.locator('button[data-date="2026-01-08"]');
  await expect(mixedDay.locator("[title]")).toHaveText(["● Поход · Лаба", "↻ Откат · Подвал"]);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(mixedDay.locator("span.sm\\:hidden > span")).toHaveText(["1 пох.", "1 отк."]);
  await expect(blessDay.locator("span.sm\\:hidden > span")).toHaveText(["1 пох.", "2 отк."]);
  await page.screenshot({
    path: testInfo.outputPath("calendar-raids-first-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({
    path: testInfo.outputPath("calendar-raids-first-desktop.png"),
    fullPage: true,
  });
  await expect(cell.getByText(/Ещё \d+/)).toBeVisible();
  expect(
    await page.locator("button[data-date]").evaluateAll((buttons) =>
      buttons.flatMap((button) =>
        Array.from(button.querySelectorAll("span"))
          .filter((span) => span.textContent?.trim().startsWith("Ещё"))
          .filter(
            (span) =>
              span.getBoundingClientRect().bottom >
              (button.closest('[role="gridcell"]')?.getBoundingClientRect().bottom ?? 0) + 1,
          )
          .map(() => button.getAttribute("data-date")),
      ),
    ),
  ).toEqual([]);
  const panel = await selectDay(page, "2026-01-07");
  await expect(panel.getByRole("link", { name: "Лаба ↗", exact: true })).toHaveCount(5);
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(cell).toBeFocused();
  await cell.press("ArrowRight");
  await expect(page.locator('button[data-date="2026-01-08"]')).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: dayTitle("2026-01-08"), exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Следующий месяц", exact: true }).click();
  await expect(page).toHaveURL(/month=2026-02/);
  await expect(page.getByRole("gridcell")).toHaveCount(monthDates("2026-02").length);
  await page.goBack();
  await expect(page).toHaveURL(/month=2026-01/);
  await page.goto("/calendar?month=2028-02");
  await expect(page.locator('button[data-date="2028-02-29"]')).toBeVisible();
  await selectDay(page, "2028-02-29");
  await expect(page.getByRole("link", { name: "Записать поход", exact: true })).toHaveCount(0);
  await expect(
    page.getByText("Будущий день — состоявшихся походов ещё нет.", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/calendar?month=2026-12");
  await page.getByRole("button", { name: "Следующий месяц", exact: true }).click();
  await expect(page).toHaveURL(/month=2027-01/);
});

test("recording a party raid updates history without daily-reset warnings", async ({
  page,
  local,
}) => {
  await page.goto("/calendar");
  const today = calendarDate(new Date());
  const dailyWarning = page
    .getByRole("alert", { name: "Незакрытые инстансы" })
    .locator("summary", { hasText: /^Подвал/ });
  await expect(dailyWarning).toHaveCount(0);
  const panel = await selectDay(page, today);
  await panel.getByRole("link", { name: "Записать поход", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`calendarDate=${today}`));
  await page.getByRole("combobox", { name: "Инстанс", exact: true }).fill("Fortress");
  await page.getByRole("option").filter({ hasText: "Fortress/Castle Dungeon" }).click();
  await page.getByRole("checkbox", { name: /Hero1/ }).uncheck();
  await page.getByRole("button", { name: "Создать рейд", exact: true }).click();
  await expect(page).toHaveURL(/\/raids\/(?!new)[^/?]+(?:\?.*)?$/);
  const raidId = new URL(page.url()).pathname.split("/").at(-1)!;
  await page.goto("/calendar");
  await expect(dailyWarning).toHaveCount(0);
  const history = await selectDay(page, today);
  await expect(history.getByRole("link", { name: "Подвал ↗", exact: true })).toHaveAttribute(
    "href",
    new RegExp(`^/raids/${raidId}\\?returnTo=`),
  );
  expect(
    (
      await local.db.query(
        'SELECT status FROM "RaidParticipant" WHERE "raidId"=$1 AND "memberId"=$2',
        [raidId, `${local.partyId}-member-1`],
      )
    ).rows[0].status,
  ).toBe("ABSENT");
  expect(
    (
      await local.db.query('SELECT COUNT(*)::int AS n FROM "LedgerEntry" WHERE "partyId"=$1', [
        local.partyId,
      ])
    ).rows[0].n,
  ).toBe(0);
});

test("calendar and static schedule work on desktop and mobile without demo controls", async ({
  page,
  local,
}, testInfo) => {
  await page.goto("/calendar?month=2026-11");
  await page.setViewportSize({ width: 1440, height: 900 });
  const toggle = page.getByRole("button", { name: /^(Показывать|Скрыть) откаты$/ });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("grid").locator('[title^="Откат:"]')).toHaveCount(0);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(toggle).toHaveText("Скрыть откаты");
  await expect(page.getByRole("grid").locator('[title="Откат: Лаба"]').first()).toBeVisible();
  await page.reload();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(toggle).toHaveText("Скрыть откаты");
  await toggle.click();
  await expect(toggle).toHaveText("Показывать откаты");
  await expect(page.getByRole("grid").locator('[title^="Откат:"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: /демо|Подключить расписание/i })).toHaveCount(0);
  await page.getByRole("combobox", { name: "Фильтр инстанса" }).click();
  const options = page.getByRole("option");
  await expect(options).toHaveCount(8);
  await expect(page.getByRole("option", { name: /Фринт|Ночн|Соло|Истин/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  const trigger = page.getByRole("button", { name: "Расписание откатов", exact: true });
  await trigger.click();
  let reference = page.getByRole("dialog", { name: "Расписание откатов", exact: true });
  await expect(reference.getByRole("row")).toHaveCount(8);
  await expect(reference.getByRole("row").filter({ hasText: "Понедельник" })).toContainText(
    "Подвал; Закен; Близы; Тиата",
  );
  await expect(reference.getByRole("row").filter({ hasText: "Среда" })).toContainText(
    "Подвал; Лаба; Фрея / Блесс",
  );
  await expect(reference).toContainText("06:30, Europe/Kyiv");
  await page.keyboard.press("Escape");
  await expect(reference).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.getByRole("button", { name: "Следующий месяц" }).click();
  await trigger.click();
  reference = page.getByRole("dialog", { name: "Расписание откатов", exact: true });
  await expect(reference.getByRole("row").filter({ hasText: "Вторник" })).toHaveText(
    "ВторникПодвал",
  );
  await page.keyboard.press("Escape");
  for (const width of [390, 320, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole("grid")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    await page.screenshot({ path: testInfo.outputPath(`calendar-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await trigger.click();
  reference = page.getByRole("dialog", { name: "Расписание откатов", exact: true });
  await expect(reference.getByRole("row")).toHaveCount(8);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await selectDay(page, "2026-12-02");
  await expect(
    page.getByRole("dialog", { name: dayTitle("2026-12-02"), exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("calendar-day-mobile.png"), fullPage: true });
  expect(
    (
      await local.db.query(
        "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('CalendarRule','CalendarClosure')",
      )
    ).rows,
  ).toEqual([]);
});

test("group isolation and MEMBER permissions apply to the day panel and new-raid prefill", async ({
  page,
  context,
  local,
}) => {
  const raid = await local.addRaid();
  await setRaid(local, raid, "LAB_78", "2026-01-07T10:00:00Z");
  const other = `e2e-calendar-${randomUUID()}`;
  await local.db.query('INSERT INTO "Party" (id,name,"updatedAt") VALUES ($1,$1,NOW())', [other]);
  await local.db.query(
    'INSERT INTO "PartyMembership" (id,"partyId","userId",role) VALUES ($1,$2,$3,\'MEMBER\')',
    [`${other}-access`, other, local.userId],
  );
  await page.goto("/calendar?month=2026-01&day=2026-01-07");
  const originalPartyDay = await selectDay(page, "2026-01-07");
  await expect(originalPartyDay.getByRole("link", { name: "Лаба ↗", exact: true })).toHaveAttribute(
    "href",
    new RegExp(`^/raids/${raid}\\?returnTo=`),
  );
  await local.db.query('UPDATE "PartyMembership" SET role=\'MEMBER\' WHERE "partyId"=$1', [
    local.partyId,
  ]);
  await page.reload();
  await expect(page.getByRole("link", { name: "Записать поход", exact: true })).toHaveCount(0);
  await page.goto("/raids/new?calendarDate=2026-01-07");
  await expect(page).toHaveURL(/\/dashboard$/);
  const cookie = (await context.cookies()).find((c) => c.name === "party-bank-active-party")!;
  await context.addCookies([{ ...cookie, value: other }]);
  await page.goto("/calendar?month=2026-01&day=2026-01-07");
  await page.keyboard.press("Escape");
  const isolatedDay = page.getByRole("dialog", {
    name: dayTitle("2026-01-07"),
    exact: true,
  });
  await selectDay(page, "2026-01-07");
  await expect(isolatedDay).toBeVisible();
  await expect(isolatedDay.getByText("Походы группы не записаны.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Лаба ↗", exact: true })).toHaveCount(0);
  expect(
    (
      await local.db.query('SELECT COUNT(*)::int AS n FROM "Raid" WHERE "partyId"=$1', [
        local.partyId,
      ])
    ).rows[0].n,
  ).toBe(1);
});
