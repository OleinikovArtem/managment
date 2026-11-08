import { test as base, expect, type BrowserContext } from "@playwright/test";

type State = Awaited<ReturnType<BrowserContext["storageState"]>>;

// Authenticate once per worker; keep cookies in memory and isolate each test's context.
export const test = base.extend<object, { accountState: State }>({
  accountState: [async ({ browser }, provide, workerInfo) => {
    const username = process.env.E2E_USERNAME;
    const password = process.env.E2E_PASSWORD;
    if (!username || !password) throw new Error("Set E2E_USERNAME and E2E_PASSWORD in local .env.");
    const baseURL = String(workerInfo.project.use.baseURL);
    const context = await browser.newContext({ baseURL });
    try {
      const response = await context.request.post("/api/auth/sign-in/username", {
        data: { username, password },
        headers: { Origin: baseURL },
      });
      expect(response.status(), "Existing local account login must succeed").toBe(200);
      const page = await context.newPage();
      await page.goto("/parties");
      await expect(page.getByRole("heading", { name: "Ваши группы" })).toBeVisible({ timeout: 30_000 });
      await page.getByRole("button", { name: "Открыть", exact: true }).first().click();
      await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
      await provide(await context.storageState());
    } finally {
      await context.close();
    }
  }, { scope: "worker", timeout: 90_000 }],
  storageState: async ({ accountState }, provide) => provide(accountState),
});

export { expect };
