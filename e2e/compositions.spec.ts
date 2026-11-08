import { test, expect } from "./local-fixtures";

test("composition professions apply to a new raid without changing member classes", async ({ page, local }) => {
  await page.goto("/compositions");
  await page.getByRole("button", { name: "Новый состав", exact: true }).click();
  await page.getByLabel("Название", { exact: true }).fill("P1 Composition");
  for (const n of [0, 1]) await page.getByRole("checkbox", { name: `Добавить Hero${n} в состав`, exact: true }).check();
  await page.getByRole("combobox", { name: "Профессия Hero0", exact: true }).fill("Duelist");
  await page.getByRole("option", { name: /Duelist.*Subclass 3/ }).click();
  await page.getByRole("combobox", { name: "Профессия Hero1", exact: true }).fill("Archmage");
  await page.getByRole("option", { name: /Archmage/ }).click();
  await page.getByRole("button", { name: "Сохранить состав", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Новый состав", exact: true })).toHaveCount(0, { timeout: 30_000 });
  await page.reload();
  await expect(page.getByRole("button", { name: "Действия состава P1 Composition", exact: true })).toBeVisible();
  await page.goto("/raids/new");
  await expect(page.getByRole("button", { name: "Создать рейд", exact: true })).toBeEnabled({ timeout: 30_000 });
  await page.getByLabel("Шаблон состава", { exact: true }).selectOption({ label: "P1 Composition" });
  await expect(page.getByRole("combobox", { name: "Профессия Hero0", exact: true })).toHaveValue("Duelist");
  await expect(page.getByRole("combobox", { name: "Профессия Hero1", exact: true })).toHaveValue("Archmage");
  await page.getByRole("button", { name: "Создать рейд", exact: true }).click();
  await expect(page).toHaveURL(/\/raids\/(?!new$)[^/]+$/, { timeout: 30_000 });
  const raidId = new URL(page.url()).pathname.split("/").at(-1);
  const rows = (await local.db.query('SELECT "profileId","classSnapshot" FROM "RaidParticipant" WHERE "raidId"=$1 ORDER BY "nicknameSnapshot"', [raidId])).rows;
  expect(rows).toEqual([{ profileId: `${local.partyId}-profile`, classSnapshot: "Duelist" }, { profileId: null, classSnapshot: "Archmage" }]);
  expect((await local.db.query('SELECT "className" FROM "PartyMember" WHERE "partyId"=$1', [local.partyId])).rows).toEqual([{ className: "Cardinal" }, { className: "Cardinal" }]);
});
