import type { Page } from "@playwright/test";
import { expect } from "./fixtures";

export async function sell(page: Page, amount = "10м", comment?: string) {
  await page.goto("/loot");
  await page.getByRole("button", { name: "Отметить продажу", exact: true }).click();
  await page.getByLabel("Полученная сумма Adena", { exact: true }).fill(amount);
  if (comment !== undefined) {
    await page.getByRole("button", { name: "Добавить комментарий", exact: true }).click();
    await page.getByLabel("Комментарий к продаже", { exact: true }).fill(comment);
  }
  await page.getByRole("button", { name: "Записать продажу", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });
}

export async function pay(page: Page, amount = "1", comment?: string) {
  await page.goto("/sales");
  await page.getByRole("button", { name: /^Оформить передачу Adena участнику Hero0:/ }).click();
  await page.getByLabel("Сумма передачи Adena для Hero0", { exact: true }).fill(amount);
  if (comment !== undefined) {
    await page.getByRole("button", { name: "Добавить комментарий", exact: true }).click();
    await page.getByLabel("Комментарий к передаче Adena для Hero0", { exact: true }).fill(comment);
  }
  await page.getByRole("button", { name: "Записать передачу", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });
}
