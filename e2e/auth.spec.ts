import { expect, test } from "@playwright/test";
import { Pool } from "pg";

test("guest is redirected from protected pages", async ({ page }) => {
  for (const path of [
    "/dashboard",
    "/members",
    "/compositions",
    "/raids/new",
    "/items",
    "/loot",
    "/sales",
    "/ledger",
    "/telegram",
    "/settings",
    "/settings/access",
    "/settings/activity",
    "/profile",
    "/parties",
  ]) {
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

test("login opens the sole group or lets the user continue into a chosen group", async ({
  page,
}, testInfo) => {
  const username = process.env.E2E_USERNAME;
  const password = process.env.E2E_PASSWORD;
  if (!username || !password) throw new Error("Set E2E_USERNAME and E2E_PASSWORD in local .env.");
  const db = new Pool({
    connectionString: process.env.E2E_DATABASE_URL ?? process.env.TEST_DATABASE_URL,
  });
  const { rows: groups } = await db
    .query<{ id: string; name: string }>(
      `SELECT p.id, p.name FROM "Party" p
     JOIN "PartyMembership" m ON m."partyId" = p.id
     JOIN "User" u ON u.id = m."userId" WHERE u.username = $1 ORDER BY m."createdAt", p.id`,
      [username],
    )
    .finally(() => db.end());

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page.getByLabel(/^Логин/).fill(username);
  await page.getByLabel(/^Пароль/).fill(password);
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/auth/sign-in/username") &&
      response.request().method() === "POST",
    { timeout: 30_000 },
  );
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  if (groups.length === 0) {
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByRole("button", { name: "Создать группу" })).toBeEnabled();
    return;
  }

  const group = groups[0];
  if (groups.length > 1) {
    await expect(page).toHaveURL(/\/parties$/);
    const choices = page.getByRole("button", { name: /^Продолжить в группе / });
    await expect(choices).toHaveCount(groups.length);
    await page.screenshot({ path: testInfo.outputPath("group-picker-mobile.png") });
    const choice = page
      .getByRole("button", { name: `Продолжить в группе ${group.name}`, exact: true })
      .first();
    await choice.focus();
    await expect(choice).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/parties");
    const activeRow = page
      .getByRole("listitem")
      .filter({ has: page.getByText("Активная", { exact: true }) });
    await expect(
      activeRow.getByRole("button", { name: `Продолжить в группе ${group.name}` }),
    ).toBeEnabled();
    await activeRow.getByRole("button", { name: /^Продолжить в группе / }).click();
  }

  await expect(page).toHaveURL(/\/dashboard$/);
  await page.reload();
  await page.getByRole("button", { name: "Меню" }).click();
  const menu = page.getByRole("dialog", { name: "Навигация" });
  await expect(menu.getByText(group.name, { exact: true })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Выйти" })).toBeInViewport();
  await page.screenshot({
    path: testInfo.outputPath("sidebar-mobile.png"),
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1440, height: 760 });
  const signOut = page.locator(".app-sidebar").getByRole("button", { name: "Выйти" });
  await expect(signOut).toBeVisible();
  const bounds = await signOut.boundingBox();
  expect(bounds!.y + bounds!.height).toBeGreaterThan(720);
  await page.screenshot({ path: testInfo.outputPath("sidebar-desktop.png") });
});
