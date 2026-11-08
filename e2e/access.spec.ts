import { randomBytes, createHash } from "node:crypto";
import { test, expect } from "./local-fixtures";
import { nextActionRequest, replayArguments, sendActionArguments } from "./action-request";

test("invitation creation, guest preview, acceptance and single use", async ({ page, browser, local, baseURL }) => {
  await page.goto("/settings/access");
  await page.getByLabel("Роль приглашённого").selectOption("ADMIN");
  await page.getByRole("button", { name: "Создать ссылку", exact: true }).click();
  const input = page.getByLabel("Новая ссылка — показывается только сейчас");
  await expect(input).toBeVisible({ timeout: 30_000 });
  const link = await input.inputValue();
  const guest = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  try {
    const preview = await guest.newPage();
    await preview.goto(link);
    await expect(preview.getByRole("heading", { name: local.partyId, exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(preview.getByRole("link", { name: "Войти", exact: true })).toBeVisible();
    expect((await local.db.query('SELECT COUNT(*)::int AS n FROM "PartyMembership" WHERE "partyId"=$1', [local.partyId])).rows[0].n).toBe(1);
  } finally { await guest.close(); }
  // The same existing account joins as invitee; no registration is needed.
  await local.db.query('UPDATE "PartyMembership" SET "userId"=$1 WHERE "partyId"=$2', [local.otherUserId, local.partyId]);
  await page.goto(link);
  await page.getByRole("button", { name: "Присоединиться", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
  expect((await local.db.query('SELECT role FROM "PartyMembership" WHERE "partyId"=$1 AND "userId"=$2', [local.partyId, local.userId])).rows[0].role).toBe("ADMIN");
  await page.goto(link);
  await expect(page.getByRole("heading", { name: "Приглашение недействительно" })).toBeVisible({ timeout: 30_000 });
});

test("revoked and expired invitations cannot grant membership", async ({ page, local }) => {
  await page.goto("/settings/access");
  await page.getByRole("button", { name: "Создать ссылку", exact: true }).click();
  const input = page.getByLabel("Новая ссылка — показывается только сейчас");
  await expect(input).toBeVisible({ timeout: 30_000 });
  const link = await input.inputValue();
  await page.reload();
  await page.getByRole("button", { name: "Отозвать", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Отозвать", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0, { timeout: 30_000 });
  await page.goto(link);
  await expect(page.getByRole("heading", { name: "Приглашение недействительно" })).toBeVisible();
  const token = randomBytes(32).toString("base64url");
  await local.db.query('INSERT INTO "PartyInvitation" (id,"partyId","tokenHash","createdByUserId",role,"expiresAt") VALUES ($1,$2,$3,$4,\'MEMBER\',NOW()-INTERVAL \'1 day\')', [token, local.partyId, createHash("sha256").update(token).digest("hex"), local.userId]);
  await page.goto(`/invite/${token}`);
  await expect(page.getByRole("heading", { name: "Приглашение недействительно" })).toBeVisible();
  expect((await local.db.query('SELECT COUNT(*)::int AS n FROM "PartyMembership" WHERE "partyId"=$1', [local.partyId])).rows[0].n).toBe(1);
});

test("owner changes roles and revokes access while retaining group data", async ({ page, local }) => {
  const other = (await local.db.query('SELECT "displayName" FROM "User" WHERE id=$1', [local.otherUserId])).rows[0];
  await local.db.query('INSERT INTO "PartyMembership" (id,"partyId","userId",role) VALUES ($1,$2,$3,\'MEMBER\')', [`${local.partyId}-other`, local.partyId, local.otherUserId]);
  await page.goto("/settings/access");
  const role = page.getByLabel(`Роль ${other.displayName}`, { exact: true });
  await role.selectOption("ADMIN");
  const changePromise = nextActionRequest(page);
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  const changeRequest = await changePromise;
  await expect.poll(async () => (await local.db.query('SELECT role FROM "PartyMembership" WHERE id=$1', [`${local.partyId}-other`])).rows[0].role).toBe("ADMIN");
  expect(await replayArguments(page, changeRequest, [`${local.partyId}-owner`, "MEMBER"])).toContain('"ok":false');
  expect((await local.db.query('SELECT role FROM "PartyMembership" WHERE id=$1', [`${local.partyId}-owner`])).rows[0].role).toBe("OWNER");
  await page.reload();
  await expect(page.getByLabel(`Роль ${other.displayName}`, { exact: true })).toHaveValue("ADMIN");
  await expect(page.getByText("Полный доступ", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Отозвать доступ", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Отозвать доступ", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0, { timeout: 30_000 });
  expect((await local.db.query('SELECT COUNT(*)::int AS n FROM "PartyMembership" WHERE "partyId"=$1', [local.partyId])).rows[0].n).toBe(1);
  expect((await local.db.query('SELECT COUNT(*)::int AS n FROM "PartyMember" WHERE "partyId"=$1', [local.partyId])).rows[0].n).toBe(2);
});

for (const role of ["OWNER", "ADMIN", "MEMBER"]) {
  test(`${role} has the expected management and owner-only controls`, async ({ page, local }) => {
    await local.db.query('UPDATE "PartyMembership" SET role=$1 WHERE "partyId"=$2', [role, local.partyId]);
    await page.goto("/members");
    await expect(page.getByRole("heading", { name: "Участники", exact: true })).toBeVisible();
    if (role === "MEMBER") await expect(page.getByRole("button", { name: "Добавить участника", exact: true })).toHaveCount(0);
    else await expect(page.getByRole("button", { name: "Добавить участника", exact: true })).toBeVisible();
    await page.goto("/settings?tab=reset");
    if (role === "OWNER") await expect(page.getByRole("heading", { name: "Опасная зона" })).toBeVisible({ timeout: 30_000 });
    else await expect(page.getByText("Сбрасывать данные группы может только владелец.", { exact: true })).toBeVisible({ timeout: 30_000 });
    await page.goto("/settings?tab=telegram");
    if (role !== "OWNER") await expect(page.getByText("Настраивать receiving bot может только владелец группы.", { exact: true })).toBeVisible();
    await page.goto("/settings/access");
    if (role === "MEMBER") await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
    else {
      await expect(page.getByRole("button", { name: "Создать ссылку", exact: true })).toBeVisible();
      if (role === "ADMIN") await expect(page.getByRole("heading", { name: "Участники группы", exact: true })).toHaveCount(0);
    }
  });
}

test("switching groups changes visible data and prevents cross-group raid access", async ({ page, local, context, baseURL }) => {
  const raidId = await local.addRaid();
  await page.goto("/parties");
  const row = page.locator("div.min-h-14").filter({ hasText: local.partyId });
  await expect(row.getByText("Активная", { exact: true })).toBeVisible();
  await page.locator("div.min-h-14").filter({ has: page.getByRole("button", { name: "Открыть", exact: true }) }).first().getByRole("button", { name: "Открыть", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
  await page.goto(`/raids/${raidId}`);
  await expect(page.getByRole("heading", { name: "Запись не найдена" })).toBeVisible({ timeout: 30_000 });
  await context.addCookies([{ name: "party-bank-active-party", value: local.partyId, url: baseURL! }]);
  await page.goto(`/raids/${raidId}`);
  await expect(page.getByRole("heading", { name: "P1 Fixture Raid", exact: true })).toBeVisible();
});

test("server rejects MEMBER writes and ADMIN owner-only actions with a live session", async ({ page, local }) => {
  await page.goto("/members");
  await page.getByRole("button", { name: "Добавить участника", exact: true }).click();
  await page.getByLabel("Игровой ник", { exact: true }).fill("PermissionProbe");
  const createPromise = nextActionRequest(page);
  await page.locator("form").getByRole("button", { name: "Добавить участника", exact: true }).click();
  const createRequest = await createPromise;
  await expect(page.getByRole("button", { name: "Действия: PermissionProbe", exact: true })).toBeVisible({ timeout: 30_000 });
  const args = JSON.parse(createRequest.postData()!);
  args[0].nickname = "DeniedMemberWrite";
  await local.db.query('UPDATE "PartyMembership" SET role=\'MEMBER\' WHERE "partyId"=$1', [local.partyId]);
  const denied = await sendActionArguments(page, createRequest, args);
  expect([403, 500]).toContain(denied.status());
  expect(await denied.text()).toContain("Изменять данные группы может только администратор.");
  expect((await local.db.query('SELECT id FROM "PartyMember" WHERE "partyId"=$1 AND nickname=\'DeniedMemberWrite\'', [local.partyId])).rows).toHaveLength(0);
  await local.db.query('UPDATE "PartyMembership" SET role=\'ADMIN\' WHERE "partyId"=$1', [local.partyId]);
  expect(await replayArguments(page, createRequest, args)).toContain('"ok":true');
  await local.db.query('UPDATE "PartyMembership" SET role=\'OWNER\' WHERE "partyId"=$1', [local.partyId]);
  await page.goto("/settings?tab=reset");
  const previewPromise = nextActionRequest(page);
  await page.getByRole("checkbox", { name: /^Выплаты участникам/ }).check();
  const previewRequest = await previewPromise;
  await expect(page.getByRole("textbox", { name: /Введите вручную/ })).toBeEnabled({ timeout: 30_000 });
  await local.db.query('UPDATE "PartyMembership" SET role=\'ADMIN\' WHERE "partyId"=$1', [local.partyId]);
  const forbidden = await sendActionArguments(page, previewRequest, JSON.parse(previewRequest.postData()!));
  expect([403, 500]).toContain(forbidden.status());
  expect(await forbidden.text()).toContain("Эти настройки доступны только владельцу группы.");
});
