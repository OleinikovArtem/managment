import { randomUUID } from "node:crypto";
import { test, expect } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("/parties");
  await page.getByText("Создать ещё одну группу", { exact: true }).click();
  await page.getByLabel("Название группы", { exact: true }).fill(`E2E Members ${randomUUID()}`);
  await page.getByRole("button", { name: "Создать группу", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
  await page.goto("/members");
});

test("member Main and sparse Subclass survive editing, clearing and deactivation", async ({ page }) => {
  await page.getByRole("button", { name: "Добавить участника", exact: true }).click();
  await page.getByLabel("Игровой ник", { exact: true }).fill("E2EHero");
  await page.getByRole("combobox", { name: "Main", exact: true }).fill("Cardinal");
  await page.getByRole("option", { name: /Cardinal/ }).click();
  await page.getByRole("combobox", { name: "Subclass 3", exact: true }).fill("Duelist");
  await page.getByRole("option", { name: /Duelist/ }).click();
  await page.locator("form").getByRole("button", { name: "Добавить участника", exact: true }).click();
  const row = page.locator("li").filter({ has: page.getByRole("button", { name: "Действия: E2EHero", exact: true }) });
  await expect(row.getByText("Cardinal", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(row.getByText("Subclass 3", { exact: true })).toBeVisible();
  await expect(row.getByText("Duelist", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Действия: E2EHero", exact: true }).click();
  await page.getByRole("menuitem", { name: "Изменить участника", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Subclass 1", exact: true })).toHaveValue("");
  await expect(page.getByRole("combobox", { name: "Subclass 3", exact: true })).toHaveValue("Duelist");
  await page.getByLabel("Игровой ник", { exact: true }).fill("E2ERenamed");
  await page.getByRole("button", { name: "Очистить: Subclass 3", exact: true }).click();
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("button", { name: "Действия: E2ERenamed", exact: true })).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await expect(page.getByText("Duelist", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Cardinal", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Действия: E2ERenamed", exact: true }).click();
  await page.getByRole("menuitem", { name: "Деактивировать", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Деактивировать", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0, { timeout: 30_000 });
  await page.getByLabel("Статус участников").selectOption("active");
  await expect(page.getByRole("button", { name: "Действия: E2ERenamed", exact: true })).toHaveCount(0);
  await page.getByLabel("Статус участников").selectOption("inactive");
  await expect(page.getByRole("button", { name: "Действия: E2ERenamed", exact: true })).toBeVisible();
});

test("normalized duplicate nickname is rejected without creating a second member", async ({ page }) => {
  await page.getByRole("button", { name: "Добавить участника", exact: true }).click();
  await page.getByLabel("Игровой ник", { exact: true }).fill("E2EHero");
  await page.locator("form").getByRole("button", { name: "Добавить участника", exact: true }).click();
  await expect(page.getByRole("button", { name: "Действия: E2EHero", exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Добавить участника", exact: true }).click();
  await page.getByLabel("Игровой ник", { exact: true }).fill("  e2ehero  ");
  await page.locator("form").getByRole("button", { name: "Добавить участника", exact: true }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText("Участник с таким ником уже существует.", { timeout: 30_000 });
  await page.locator("form").getByRole("button", { name: "Отмена", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: /^Действия:/ })).toHaveCount(1);
});
