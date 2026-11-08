import { test, expect } from "./local-fixtures";

test("logout revokes the current session and protected pages require login again", async ({
  page,
  context,
  baseURL,
  local,
}) => {
  // Sign out a fresh session, preserving the worker's shared login for other tests.
  await context.clearCookies();
  const login = await page.request.post("/api/auth/sign-in/username", {
    data: { username: process.env.E2E_USERNAME, password: process.env.E2E_PASSWORD },
    headers: { Origin: baseURL! },
  });
  expect(login.status()).toBe(200);
  await context.addCookies([
    { name: "party-bank-active-party", value: local.partyId, url: baseURL! },
  ]);
  await page.goto("/dashboard");
  const oldCookieHeader = (await context.cookies())
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/, { timeout: 30_000 });
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/login(?:\?|$)/, { timeout: 30_000 });
  expect((await page.request.get("/api/ledger/export")).status()).toBe(401);
  expect(
    (
      await page.request.get("/api/ledger/export", { headers: { Cookie: oldCookieHeader } })
    ).status(),
  ).toBe(401);
  expect(
    (
      await local.db.query('SELECT id FROM "PartyMembership" WHERE "partyId"=$1 AND "userId"=$2', [
        local.partyId,
        local.userId,
      ])
    ).rows,
  ).toHaveLength(1);
});

test("display name changes survive reload without changing login or game names", async ({
  page,
  local,
}) => {
  const before = (
    await local.db.query('SELECT "displayName",username FROM "User" WHERE id=$1', [local.userId])
  ).rows[0];
  try {
    await page.goto("/profile");
    await page.getByLabel(/^Имя для отображения/).fill("P2 Display Name");
    await page.getByRole("button", { name: "Сохранить имя", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Имя для отображения сохранено.", {
      timeout: 30_000,
    });
    await page.reload();
    await expect(page.getByLabel(/^Имя для отображения/)).toHaveValue("P2 Display Name");
    expect(
      (await local.db.query('SELECT username FROM "User" WHERE id=$1', [local.userId])).rows[0]
        .username,
    ).toBe(before.username);
    expect(
      (
        await local.db.query(
          'SELECT nickname FROM "PartyMember" WHERE "partyId"=$1 ORDER BY nickname',
          [local.partyId],
        )
      ).rows,
    ).toEqual([{ nickname: "Hero0" }, { nickname: "Hero1" }]);
    await page.getByLabel(/^Имя для отображения/).fill(before.displayName);
    await page.getByRole("button", { name: "Сохранить имя", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Имя для отображения сохранено.", {
      timeout: 30_000,
    });
  } finally {
    // Restore this shared local account even when a UI assertion fails.
    await local.db.query('UPDATE "User" SET "displayName"=$1 WHERE id=$2', [
      before.displayName,
      local.userId,
    ]);
  }
});

test("renaming a group persists and records the author in the activity log", async ({
  page,
  local,
}) => {
  const name = `P2 Renamed ${local.partyId}`;
  await page.goto("/settings");
  await expect(page.getByLabel("Название группы", { exact: true })).toHaveValue(local.partyId, {
    timeout: 30_000,
  });
  await page.getByLabel("Название группы", { exact: true }).fill(name);
  await expect(page.getByLabel("Название группы", { exact: true })).toHaveValue(name);
  const form = page
    .locator("form")
    .filter({ has: page.getByLabel("Название группы", { exact: true }) });
  await form.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(form.getByRole("status")).toHaveText("Настройки группы сохранены.", {
    timeout: 30_000,
  });
  await page.reload();
  await expect(page.getByLabel("Название группы", { exact: true })).toHaveValue(name);
  await page.goto("/settings/activity");
  const summary = `Переименовал группу в «${name}».`;
  const row = page.getByRole("listitem").filter({ hasText: summary });
  await expect(row).toBeVisible({ timeout: 30_000 });
  await expect(row).toContainText(`@${process.env.E2E_USERNAME}`);
  expect(
    (
      await local.db.query(
        'SELECT "actorUserId",summary FROM "PartyAuditEvent" WHERE "partyId"=$1',
        [local.partyId],
      )
    ).rows,
  ).toEqual([{ actorUserId: local.userId, summary }]);
});
