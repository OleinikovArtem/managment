import { test, expect } from "./local-fixtures";
import { addCalendarDays, calendarDate, dayTitle } from "../src/features/calendar/month-calendar-model";

test.use({ timezoneId: "Europe/Kyiv" });

test("raid views share navigation, preserve each mode state and redirect legacy calendar URLs", async ({ page, local }) => {
  await page.goto("/raids");
  await expect(page).toHaveURL(/\/raids\?view=calendar/);
  await expect(page.getByRole("grid", { name: /Календарь/ })).toBeVisible();

  const raidId = await local.addRaid();
  const instance = (
    await local.db.query(
      'SELECT id,COALESCE(NULLIF("displayName",\'\'),name) AS label FROM "Instance" WHERE code=$1 AND "partyId" IS NULL',
      ["LAB_83"],
    )
  ).rows[0];
  await local.db.query(
    'UPDATE "Raid" SET "instanceId"=$1,"instanceName"=$2,"occurredAt"=$3::timestamp WHERE id=$4',
    [instance.id, instance.label, "2026-01-15 12:00:00", raidId],
  );
  await page.goto(`/raids?view=list&instance=${instance.id}&month=2026-01`);
  await expect(page.getByRole("link", { name: /P1 Fixture Raid/ })).toBeVisible();
  await page.getByRole("tab", { name: "Календарь", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Фильтр инстанса" })).toHaveValue(instance.label);
  await expect(page.locator('[data-date="2026-01-15"]')).toContainText("Поход · Лаба");

  await page.goto("/calendar?month=2026-01&day=2026-01-07&instance=lab-id&member=member-id&resets=1");
  await expect(page).toHaveURL(/\/raids\?month=2026-01&day=2026-01-07&instance=lab-id&member=member-id&resets=1&view=calendar/);
  const calendarTab = page.getByRole("tab", { name: "Календарь", exact: true });
  await calendarTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Список", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/view=list/);
  expect(new URL(page.url()).searchParams.get("instance")).toBe("lab-id");
  expect(new URL(page.url()).searchParams.get("member")).toBe("member-id");
  await page.getByRole("tab", { name: "Список", exact: true }).focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/view=calendar/);
  expect(new URL(page.url()).searchParams.get("day")).toBe("2026-01-07");
});

test("top action uses current time; day plus presets only today or past", async ({ page, local }) => {
  await page.goto("/raids?view=list");
  await page.getByRole("button", { name: "Записать поход", exact: true }).click();
  const date = page.getByLabel("Дата и время", { exact: true });
  const today = calendarDate(new Date());
  const [year, month, day] = today.split("-");
  await expect(date).toHaveValue(new RegExp(`^${day}\\.${month}\\.${year} `));
  await page.goto(`/raids?view=calendar&month=${today.slice(0, 7)}`);
  await expect(page.getByRole("grid")).toBeVisible();

  const todayPlus = page.getByRole("button", {
    name: `Записать поход за ${dayTitle(today)}`,
    exact: true,
  });
  await todayPlus.click();
  await expect(page).toHaveURL(new RegExp(`calendarDate=${today}`));
  await expect(date).toHaveValue(new RegExp(`^${day}\\.${month}\\.${year} `));

  const tomorrow = addCalendarDays(today, 1);
  if (tomorrow.slice(0, 7) !== today.slice(0, 7)) {
    await page.goto(`/raids?view=calendar&month=${tomorrow.slice(0, 7)}`);
  }
  await expect(
    page.getByRole("button", { name: `Записать поход за ${dayTitle(tomorrow)}`, exact: true }),
  ).toHaveCount(0);

  await page.goto("/raids/new");
  const [futureYear, futureMonth, futureDay] = tomorrow.split("-");
  await date.fill(`${futureDay}.${futureMonth}.${futureYear} 12:00`);
  await date.press("Tab");
  await page.getByRole("button", { name: "Создать рейд", exact: true }).click();
  await expect(page.getByText("Нельзя записать поход в будущем.", { exact: true })).toBeVisible();
  expect(
    (await local.db.query('SELECT COUNT(*)::int AS count FROM "Raid" WHERE "partyId"=$1', [local.partyId])).rows[0].count,
  ).toBe(0);
});
