import { expect, test } from "@playwright/test";

test("guest is redirected from protected pages", async ({ page }) => {
  for (const path of ["/dashboard", "/members", "/compositions", "/raids/new", "/items", "/loot", "/sales", "/ledger", "/telegram", "/settings", "/settings/access", "/settings/activity", "/profile", "/parties"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await expect(page.getByRole("button", { name: "Войти", exact: true })).toBeVisible();
  }
});

test("guest cannot download financial history", async ({ request }) => {
  const response = await request.get("/api/ledger/export");
  expect(response.status()).toBe(401);
  expect(await response.text()).toBe("");
});

test("existing local user can log in", async ({ page }) => {
  const username = process.env.E2E_USERNAME;
  const password = process.env.E2E_PASSWORD;
  if (!username || !password) throw new Error("Set E2E_USERNAME and E2E_PASSWORD in local .env.");

  await page.goto("/login");
  await page.getByLabel(/^Логин/).fill(username);
  await page.getByLabel(/^Пароль/).fill(password);
  const responsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/api/auth/sign-in/username") && response.request().method() === "POST",
    { timeout: 30_000 },
  );
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  await expect(page).toHaveURL(/\/(onboarding|parties)(?:\?|$)/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: /^(Ваши группы|Создайте свою группу)$/ })).toBeVisible({ timeout: 30_000 });
});
