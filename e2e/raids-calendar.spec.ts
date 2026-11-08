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
  await calendarTab.press("ArrowRight");
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
  await page.goBack();
  await expect(page).toHaveURL(/view=list/);
  await expect(page.getByRole("tab", { name: "Список", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.goForward();
  await expect(page).toHaveURL(/view=calendar/);
  await expect(page.getByRole("tab", { name: "Календарь", exact: true })).toHaveAttribute("aria-selected", "true");
});

test("list filters, empty reset, detail return context and viewport widths work", async ({ page, local }) => {
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
  await page.goto(`/raids?view=list&instance=${instance.id}&q=Fixture&period=all&page=1`);
  const raidLink = page.getByRole("link", { name: /P1 Fixture Raid/ });
  await expect(raidLink).toBeVisible();
  await expect(page.getByRole("status")).toContainText("1 рейд");
  await raidLink.click();
  await expect(page).toHaveURL(new RegExp(`/raids/${raidId}\\?returnTo=`));
  await page.locator("[data-raid-detail] .raidDetail-breadcrumb a").click();
  await expect(page).toHaveURL(/view=list/);
  expect(new URL(page.url()).searchParams.get("instance")).toBe(instance.id);
  expect(new URL(page.url()).searchParams.get("q")).toBe("Fixture");

  await page.getByRole("textbox", { name: "Поиск рейдов" }).fill("no matching raid");
  await expect(page.getByText("Рейдов по этим условиям нет. Измените поиск или сбросьте фильтры.")).toBeVisible();
  await page.getByRole("button", { name: "Сбросить фильтры", exact: true }).click();
  await expect(page.getByRole("link", { name: /P1 Fixture Raid/ })).toBeVisible();

  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole("tablist", { name: "Режим отображения походов" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
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
