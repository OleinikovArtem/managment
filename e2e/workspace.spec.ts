import { randomUUID } from "node:crypto";
import { test, expect } from "./fixtures";

test("group sections load after selecting a group", async ({ page }) => {
  for (const [path, heading] of [
    ["/dashboard", "Обзор"], ["/members", "Участники"],
    ["/compositions", "Составы"], ["/raids", "Походы"],
    ["/loot", "Лут"], ["/sales", "Финансы"], ["/ledger", "Финансы"],
    ["/items", "Предметы"], ["/telegram", "Продажи из Telegram"],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading, exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Не удалось загрузить страницу" })).toHaveCount(0);
  }
});

test("raid search and period survive reload", async ({ page }) => {
  const query = `e2e-no-match-${randomUUID()}`;
  await page.goto("/raids?view=list");
  await page.getByRole("textbox", { name: "Поиск рейдов" }).fill(query);
  await page.getByLabel("Фильтр по периоду").selectOption("upcoming");
  await expect(page).toHaveURL(new RegExp(`q=${query}.*period=upcoming`));
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Поиск рейдов" })).toHaveValue(query);
  await expect(page.getByLabel("Фильтр по периоду")).toHaveValue("upcoming");
  await expect(page.getByRole("region", { name: "Список рейдов" }).getByRole("status")).toHaveText("0 рейдов");
});

test("loot filters and grouping survive reload", async ({ page }) => {
  await page.goto("/loot");
  await page.getByRole("button", { name: /^Проданные/ }).click();
  await expect(page).toHaveURL(/status=sold/);
  await expect(page.getByRole("button", { name: /^Проданные/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Объединить одинаковые").click();
  await expect(page).toHaveURL(/combine=1/);
  await expect(page.getByLabel("Объединить одинаковые")).toBeChecked();
  await page.reload();
  await expect(page.getByRole("button", { name: /^Проданные/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Объединить одинаковые")).toBeChecked();
});

test("ledger export downloads a CSV for the active group", async ({ page }) => {
  await page.goto("/ledger");
  const response = await page.request.get("/api/ledger/export");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/csv");
  expect(response.headers()["content-disposition"]).toContain('filename="financial-history.csv"');
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  expect((await response.text()).replace(/^\uFEFF/, "").split(/\r?\n/)[0]).toBe(
    "Операция,Дата,Предмет,Рейд,Количество,Сумма Adena,Участник,Доля с продажи Adena,Комментарий",
  );
});
