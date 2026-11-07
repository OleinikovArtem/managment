import { expect, test } from "@playwright/test";

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
  { name: "narrow mobile", width: 320, height: 844 },
]) {
  test(`login page is usable at ${viewport.name} width`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: "Вход в группу" })).toBeVisible();
    await expect(page.getByLabel("Логин")).toBeVisible();
    await expect(page.getByLabel("Пароль")).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });
}
