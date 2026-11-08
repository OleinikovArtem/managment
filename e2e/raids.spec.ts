import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { test, expect } from "./fixtures";

test.use({ timezoneId: "Europe/Kyiv" });
let pool: Pool;
test.beforeAll(() => {
  pool = new Pool({ connectionString: process.env.E2E_DATABASE_URL ?? process.env.TEST_DATABASE_URL });
});
test.afterAll(async () => { await pool?.end(); });

test.beforeEach(async ({ page, context }) => {
  await page.goto("/parties");
  await page.getByText("Создать ещё одну группу", { exact: true }).click();
  await page.getByLabel("Название группы", { exact: true }).fill(`E2E Raids ${randomUUID()}`);
  await page.getByRole("button", { name: "Создать группу", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
  const partyId = (await context.cookies()).find((cookie) => cookie.name === "party-bank-active-party")!.value;
  for (const nickname of ["RaidHero", "RaidAbsent"]) {
    await pool.query('INSERT INTO "PartyMember" (id,"partyId",nickname,"normalizedNickname","className","updatedAt") VALUES ($1,$2,$3,$4,\'Cardinal\',NOW())', [randomUUID(), partyId, nickname, nickname.toLowerCase()]);
  }
  await page.goto("/raids/new");
});

test("create and edit raid through UI preserve attendance, local date and catalog loot", async ({ page, context }) => {
  const partyId = (await context.cookies()).find((cookie) => cookie.name === "party-bank-active-party")!.value;
  const item = (await pool.query('SELECT id, COALESCE(NULLIF("displayName",\'\'),"canonicalName") AS name FROM "Item" WHERE "partyId" IS NULL AND "isActive"=true ORDER BY id LIMIT 1')).rows[0];
  expect(item, "Shared catalog must contain an active item").toBeTruthy();
  await page.getByText("Своё название", { exact: false }).click();
  await page.getByLabel("Название рейда", { exact: true }).fill("E2E Original Raid");
  await page.getByLabel("Дата и время", { exact: true }).fill("15.01.2026 18:30");
  await page.getByLabel("Дата и время", { exact: true }).press("Tab");
  await page.getByRole("checkbox", { name: /RaidAbsent/ }).uncheck();
  await page.getByRole("tab", { name: "Все предметы", exact: true }).click();
  await page.getByRole("textbox", { name: "Поиск по каталогу" }).fill(item.name);
  await page.getByRole("button", { name: `Добавить ${item.name}`, exact: true }).click();
  await page.getByLabel(`Количество ${item.name}`, { exact: true }).fill("3");
  await page.getByRole("button", { name: "Создать рейд", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "E2E Original Raid" })).toBeVisible({ timeout: 30_000 });
  const raidId = new URL(page.url()).pathname.split("/").at(-1)!;
  // Prisma stores UTC in timestamp without time zone. Read text so pg does not
  // reinterpret it in the test runner's local timezone.
  const raid = (await pool.query('SELECT "occurredAt"::text AS "occurredAt","stageId","stageNameSnapshot" FROM "Raid" WHERE id=$1 AND "partyId"=$2', [raidId, partyId])).rows[0];
  expect(raid.occurredAt).toBe("2026-01-15 16:30:00");
  const participants = (await pool.query('SELECT "nicknameSnapshot",status,"classSnapshot" FROM "RaidParticipant" WHERE "raidId"=$1 ORDER BY "nicknameSnapshot"', [raidId])).rows;
  expect(participants).toEqual([
    { nicknameSnapshot: "RaidAbsent", status: "ABSENT", classSnapshot: "Cardinal" },
    { nicknameSnapshot: "RaidHero", status: "PRESENT", classSnapshot: "Cardinal" },
  ]);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "E2E Original Raid" })).toBeVisible();
  await page.getByRole("link", { name: "Редактировать рейд", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/raids/${raidId}/edit$`), { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Редактирование рейда", exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("checkbox", { name: /RaidAbsent/ })).not.toBeChecked();
  await expect(page.getByLabel("Дата и время", { exact: true })).toHaveValue("15.01.2026 18:30");
  await expect(page.getByLabel(`Количество ${item.name}`, { exact: true })).toHaveValue("3");
  await page.getByText("Своё название", { exact: false }).click();
  await page.getByLabel("Название рейда", { exact: true }).fill("E2E Edited Raid");
  await page.getByRole("checkbox", { name: /RaidAbsent/ }).check();
  await page.getByLabel(`Количество ${item.name}`, { exact: true }).fill("5");
  await page.getByRole("button", { name: "Сохранить изменения", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "E2E Edited Raid" })).toBeVisible({ timeout: 30_000 });
  await page.reload();
  const drops = (await pool.query('SELECT "itemId",quantity FROM "LootDrop" WHERE "raidId"=$1', [raidId])).rows;
  expect(drops).toEqual([{ itemId: item.id, quantity: 5 }]);
  const after = (await pool.query('SELECT "stageId","stageNameSnapshot" FROM "Raid" WHERE id=$1', [raidId])).rows[0];
  expect(after).toEqual({ stageId: raid.stageId, stageNameSnapshot: raid.stageNameSnapshot });
  expect((await pool.query('SELECT status FROM "RaidParticipant" WHERE "raidId"=$1', [raidId])).rows.every((row) => row.status === "PRESENT")).toBe(true);
});

test("empty attendance and invalid calendar date do not create a raid", async ({ page, context }) => {
  const partyId = (await context.cookies()).find((cookie) => cookie.name === "party-bank-active-party")!.value;
  await page.getByRole("button", { name: "Снять", exact: true }).click();
  await expect(page.getByRole("button", { name: "Создать рейд", exact: true })).toBeDisabled();
  await page.getByRole("checkbox", { name: /RaidHero/ }).check();
  const date = page.getByLabel("Дата и время", { exact: true });
  await date.fill("31.02.2026 18:30");
  await date.press("Tab");
  await expect(date).toHaveAttribute("aria-invalid", "true");
  await page.getByRole("button", { name: "Создать рейд", exact: true }).click();
  await expect(page).toHaveURL(/\/raids\/new$/);
  expect((await pool.query('SELECT id FROM "Raid" WHERE "partyId"=$1', [partyId])).rows).toHaveLength(0);
});
