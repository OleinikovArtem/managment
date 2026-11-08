import { test, expect } from "./local-fixtures";
import { sell } from "./financial-ui";

for (const width of [390, 320]) {
  test(`mobile ${width}px can create a raid, sell loot and pay a member`, async ({
    page,
    local,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/raids/new");
    await page.getByText("Своё название", { exact: false }).click();
    await page.getByLabel("Название рейда", { exact: true }).fill(`P2 Mobile ${width}`);
    await page.getByRole("checkbox", { name: /Hero1/ }).uncheck();
    await page.getByRole("tab", { name: "Все предметы", exact: true }).click();
    await page.getByRole("textbox", { name: "Поиск по каталогу" }).fill(local.item.canonicalName);
    await page.getByRole("button", { name: `Добавить ${local.item.name}`, exact: true }).click();
    await page.getByLabel(`Количество ${local.item.name}`, { exact: true }).fill("2");
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await page.screenshot({ path: testInfo.outputPath("mobile-raid.png"), fullPage: true });
    await page.getByRole("button", { name: "Создать рейд", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: `P2 Mobile ${width}`, exact: true }),
    ).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Меню", exact: true }).click();
    await page
      .getByRole("dialog", { name: "Навигация", exact: true })
      .getByRole("link", { name: "Лут", exact: true })
      .click();
    await expect(page.getByRole("heading", { name: "Лут", exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("button", { name: "Отметить продажу", exact: true }).click();
    await page.getByLabel("Полученная сумма Adena", { exact: true }).fill("10м");
    await page.screenshot({
      path: testInfo.outputPath("mobile-sale.png"),
      fullPage: true,
      animations: "disabled",
    });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await page.getByRole("button", { name: "Записать продажу", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });
    await page.locator(".mobile-shell").getByRole("link", { name: "Финансы", exact: true }).click();
    await page.getByRole("button", { name: /^Оформить передачу Adena участнику Hero0:/ }).click();
    const amount = page.getByLabel("Сумма передачи Adena для Hero0", { exact: true });
    await expect(amount).toHaveValue("10");
    await amount.fill("3");
    await page.screenshot({
      path: testInfo.outputPath("mobile-payment.png"),
      fullPage: true,
      animations: "disabled",
    });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await page.getByRole("button", { name: "Записать передачу", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });
    await page.reload();
    await expect(page.locator('[title="7000000 Adena"]').first()).toBeVisible({ timeout: 30_000 });
    expect(
      (
        await local.db.query(
          'SELECT "nicknameSnapshot",amount FROM "SaleShare" WHERE "partyId"=$1',
          [local.partyId],
        )
      ).rows,
    ).toEqual([{ nicknameSnapshot: "Hero0", amount: "10000000" }]);
    expect(
      (
        await local.db.query('SELECT amount FROM "MemberPayment" WHERE "partyId"=$1', [
          local.partyId,
        ])
      ).rows,
    ).toEqual([{ amount: "3000000" }]);
  });
}

test("keyboard controls roster and profession selection", async ({ page, local }) => {
  await page.goto("/raids/new");
  const attendance = page.getByRole("checkbox", { name: /Hero1/ });
  await attendance.focus();
  await page.keyboard.press("Space");
  await expect(attendance).not.toBeChecked();
  await expect(page.locator(".raid-count").first()).toHaveText("1 из 2");
  await expect(page.getByRole("button", { name: "Создать рейд", exact: true })).toBeEnabled({
    timeout: 30_000,
  });
  const profession = page.getByRole("combobox", { name: "Профессия Hero0", exact: true });
  await profession.focus();
  await expect(profession).toBeFocused();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("Duelist", { delay: 50 });
  await expect(profession).toHaveValue("Duelist");
  await expect(page.getByRole("option", { name: /Duelist/ })).toBeVisible();
  await expect(page.getByRole("option")).toHaveCount(1);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(profession).toHaveValue("Duelist");
  await page.getByRole("button", { name: "Создать рейд", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/raids\/(?!new$)[^/]+$/, { timeout: 30_000 });
  expect(
    (
      await local.db.query(
        'SELECT "classSnapshot" FROM "RaidParticipant" WHERE "partyId"=$1 AND "nicknameSnapshot"=\'Hero0\'',
        [local.partyId],
      )
    ).rows[0].classSnapshot,
  ).toBe("Duelist");
});

test("dialogs trap keyboard focus, Escape closes them and payment drafts survive reopening", async ({
  page,
  local,
}) => {
  await local.addRaid();
  await page.goto("/loot");
  const trigger = page.getByRole("button", { name: "Отметить продажу", exact: true });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  for (const key of ["Tab", "Shift+Tab"]) {
    for (let index = 0; index < 14; index++) {
      await page.keyboard.press(key);
      // Base UI routes wrapping focus through a focus guard before restoring it.
      await expect
        .poll(() => dialog.evaluate((element) => element.contains(document.activeElement)))
        .toBe(true);
    }
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await sell(page);
  await page.goto("/sales");
  const paymentTrigger = page.getByRole("button", {
    name: /^Оформить передачу Adena участнику Hero0:/,
  });
  await paymentTrigger.focus();
  await page.keyboard.press("Enter");
  const amount = page.getByLabel("Сумма передачи Adena для Hero0", { exact: true });
  await expect(amount).toBeFocused();
  await amount.fill("0.25");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(paymentTrigger).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(amount).toHaveValue("0.25");
});
