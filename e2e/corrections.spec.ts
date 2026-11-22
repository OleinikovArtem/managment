import { randomUUID } from "node:crypto";
import { test, expect } from "./local-fixtures";
import { pay, sell } from "./financial-ui";
import { nextActionRequest, replayArguments, sendActionArguments } from "./action-request";

test.use({ timezoneId: "Europe/Kyiv" });

const screenshotOptions = {
  animations: "disabled",
  style: "nextjs-portal { display: none; }",
} as const;

test("corrects and deletes a transfer with exact balances and group permissions", async ({
  page,
  local,
  context,
  baseURL,
}, info) => {
  await local.addRaid();
  await local.db.query('UPDATE "Party" SET name=$1 WHERE id=$2', [
    "Тестовая группа",
    local.partyId,
  ]);
  await sell(page);
  await pay(page, "3", "Ошибочная запись");
  const [original] = (
    await local.db.query('SELECT id FROM "MemberPayment" WHERE "partyId"=$1', [local.partyId])
  ).rows;
  await page.goto("/ledger?type=payment");
  const originalRow = page.locator(".finance-operation").filter({ hasText: "Hero0" });
  await originalRow.locator("summary").click();
  const edit = originalRow.getByRole("button", { name: "Исправить передачу" });
  await expect(edit).toBeVisible();
  await page.screenshot({
    ...screenshotOptions,
    path: info.outputPath("01-transfer-actions-desktop.png"),
  });
  await edit.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Исправить передачу Adena" });
  await expect(dialog.getByLabel("Сумма Adena")).toHaveValue("3000000");
  await page.keyboard.press("Escape");
  await expect(edit).toBeFocused();
  await edit.click();
  await dialog.getByLabel("Получатель").selectOption({ label: "Hero1" });
  await dialog.getByLabel("Сумма Adena").fill("0");
  await dialog.getByRole("button", { name: "Сохранить исправление" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Введите сумму Adena");
  await dialog.getByLabel("Сумма Adena").fill("2450123");
  await dialog.getByLabel("Дата и время").fill("15.01.2026 18:30");
  await dialog.getByLabel("Дата и время").press("Tab");
  await dialog.getByLabel("Комментарий").fill("Исправленная передача");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(dialog).toBeInViewport();
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await page.screenshot({
    ...screenshotOptions,
    path: info.outputPath("02-edit-transfer-mobile.png"),
  });
  const editRequest = nextActionRequest(page);
  await dialog.getByRole("button", { name: "Сохранить исправление" }).click();
  const request = await editRequest;
  const args = JSON.parse(request.postData()!);
  await expect(dialog).toHaveCount(0);
  expect(await replayArguments(page, request, args)).toContain('"ok":true');
  expect(await replayArguments(page, request, [original.id, null])).toContain("уже изменена");
  await page.reload();
  const correctedRow = page.locator(".finance-operation").filter({ hasText: "Hero1" });
  await correctedRow.locator("summary").click();
  await expect(correctedRow.getByText(/2\s450\s123 Adena/)).toBeVisible();
  await expect(correctedRow.getByText("Исправленная передача")).toBeVisible();
  await expect(originalRow).toHaveCount(0);
  const [corrected] = (
    await local.db.query(
      `SELECT p.id,p.amount::text,p."paidAt"::text,SUM(a.amount)::text AS allocated
      FROM "MemberPayment" p JOIN "LedgerTransaction" t ON t."memberPaymentId"=p.id
      JOIN "PaymentAllocation" a ON a."memberPaymentId"=p.id
      WHERE p."partyId"=$1 AND t."voidedAt" IS NULL GROUP BY p.id`,
      [local.partyId],
    )
  ).rows;
  expect(corrected).toMatchObject({
    amount: "2450123",
    allocated: "2450123",
    paidAt: "2026-01-15 16:30:00",
  });
  await page.goto("/sales");
  await expect(page.locator('.finance-summary-primary [title="7549877 Adena"]')).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Оформить передачу Adena участнику Hero0:/ }),
  ).toBeVisible();
  await expect(page.locator('[title="2549877 Adena"]').first()).toBeVisible();
  const csv = await (await page.request.get("/api/ledger/export")).text();
  expect(csv).toContain("2450123");
  expect(csv).not.toContain("Ошибочная запись");

  await local.db.query('UPDATE "PartyMembership" SET role=\'MEMBER\' WHERE "partyId"=$1', [
    local.partyId,
  ]);
  await page.goto("/ledger?type=payment");
  await correctedRow.locator("summary").click();
  await expect(correctedRow.getByRole("button", { name: "Удалить передачу" })).toHaveCount(0);
  expect((await sendActionArguments(page, request, [corrected.id, null])).ok()).toBe(false);
  await local.db.query('UPDATE "PartyMembership" SET role=\'ADMIN\' WHERE "partyId"=$1', [
    local.partyId,
  ]);
  const otherParty = `e2e-isolation-${randomUUID()}`;
  await local.db.query('INSERT INTO "Party" (id,name,"updatedAt") VALUES ($1,$1,NOW())', [
    otherParty,
  ]);
  await local.db.query(
    'INSERT INTO "PartyMembership" (id,"partyId","userId",role) VALUES ($1,$1,$2,\'OWNER\')',
    [otherParty, local.userId],
  );
  const partyCookie = (value: string) =>
    context.addCookies([
      { name: "party-bank-active-party", value, url: baseURL!, httpOnly: true, sameSite: "Lax" },
    ]);
  await partyCookie(otherParty);
  expect(await replayArguments(page, request, [corrected.id, null])).toContain('"ok":false');
  await partyCookie(local.partyId);
  await page.reload();
  await correctedRow.locator("summary").click();
  await correctedRow.getByRole("button", { name: "Удалить передачу" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText(/2\s450\s123 Adena/);
  await page.screenshot({
    ...screenshotOptions,
    path: info.outputPath("03-delete-transfer-mobile.png"),
  });
  await confirm.getByRole("button", { name: "Отмена" }).click();
  await expect(correctedRow).toBeVisible();
  await correctedRow.getByRole("button", { name: "Удалить передачу" }).click();
  await confirm.getByRole("button", { name: "Удалить передачу" }).click();
  await expect(correctedRow).toHaveCount(0);
  await page.goto("/sales");
  await expect(page.locator('.finance-summary-primary [title="10000000 Adena"]')).toBeVisible();
  const payments = (
    await local.db.query(
      `SELECT p.id,p.amount::text,t."voidedAt" IS NOT NULL AS voided
      FROM "MemberPayment" p JOIN "LedgerTransaction" t ON t."memberPaymentId"=p.id
      WHERE p."partyId"=$1 ORDER BY p.amount`,
      [local.partyId],
    )
  ).rows;
  expect(payments).toEqual([
    { id: corrected.id, amount: "2450123", voided: true },
    { id: original.id, amount: "3000000", voided: true },
  ]);
});

test("removes unsold loot from a locked raid and preserves sold loot and the catalog", async ({
  page,
  local,
}, info) => {
  const raidId = await local.addRaid();
  await local.db.query('UPDATE "Party" SET name=$1 WHERE id=$2', [
    "Тестовая группа",
    local.partyId,
  ]);
  const spare = (
    await local.db.query(
      `SELECT id, COALESCE(NULLIF("displayName",''),"canonicalName") AS name FROM "Item"
      WHERE "partyId" IS NULL AND "isActive" AND id<>$1
        AND COALESCE(NULLIF("displayName",''),"canonicalName")<>$2 ORDER BY id LIMIT 1`,
      [local.item.id, local.item.name],
    )
  ).rows[0];
  expect(spare).toBeTruthy();
  const extraId = randomUUID();
  await local.db.query(
    'INSERT INTO "LootDrop" (id,"partyId","raidId","itemId",quantity,"updatedAt") VALUES ($1,$2,$3,$4,2,NOW())',
    [extraId, local.partyId, raidId, spare.id],
  );
  await local.db.query('UPDATE "Raid" SET name=$1 WHERE id=$2', [
    "Поход с лишним предметом",
    raidId,
  ]);
  await page.goto("/loot");
  const soldCard = page
    .locator("article.loot-card")
    .filter({ hasText: "Поход с лишним предметом" })
    .filter({ has: page.getByText(local.item.name, { exact: true }) });
  await soldCard.getByRole("button", { name: "Отметить продажу", exact: true }).click();
  await page.getByLabel("Полученная сумма Adena", { exact: true }).fill("10м");
  await page.getByRole("button", { name: "Записать продажу", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const sold = (
    await local.db.query('SELECT "lootDropId" FROM "SaleTransaction" WHERE "raidId"=$1', [raidId])
  ).rows[0].lootDropId;
  await page.goto(`/raids/${raidId}`);
  const remove = page.getByRole("button", { name: `Удалить предмет «${spare.name}» из рейда` });
  await expect(
    page.getByRole("button", { name: `Удалить предмет «${local.item.name}» из рейда` }),
  ).toHaveCount(0);
  await expect(remove).toBeVisible();
  await expect(page.getByText("Локальное время", { exact: true })).toHaveCount(0);
  await page.screenshot({
    ...screenshotOptions,
    path: info.outputPath("04-raid-loot-desktop.png"),
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await remove.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText(spare.name);
  await page.screenshot({
    ...screenshotOptions,
    path: info.outputPath("05-remove-loot-mobile.png"),
  });
  await page.keyboard.press("Escape");
  await expect(remove).toBeFocused();
  await remove.click();
  const pending = nextActionRequest(page);
  await dialog.getByRole("button", { name: "Удалить предмет" }).click();
  const request = await pending;
  await expect(remove).toHaveCount(0);
  expect(await replayArguments(page, request, [raidId, sold])).toContain("уже есть продажа");
  await page.reload();
  await expect(page.getByRole("link", { name: spare.name, exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: local.item.name, exact: true })).toBeVisible();
  expect(
    (await local.db.query('SELECT id FROM "LootDrop" WHERE "raidId"=$1', [raidId])).rows,
  ).toEqual([{ id: sold }]);
  expect((await local.db.query('SELECT id FROM "Item" WHERE id=$1', [spare.id])).rowCount).toBe(1);

  const otherRaid = await local.addRaid();
  const { id: otherDrop } = (
    await local.db.query('SELECT id FROM "LootDrop" WHERE "raidId"=$1', [otherRaid])
  ).rows[0];
  expect(await replayArguments(page, request, [raidId, otherDrop])).toContain('"ok":false');
  await local.db.query('UPDATE "PartyMembership" SET role=\'MEMBER\' WHERE "partyId"=$1', [
    local.partyId,
  ]);
  await page.goto(`/raids/${otherRaid}`);
  await expect(page.getByRole("link", { name: local.item.name, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Удалить предмет/ })).toHaveCount(0);
  expect((await sendActionArguments(page, request, [otherRaid, otherDrop])).ok()).toBe(false);
  expect(
    (await local.db.query('SELECT id FROM "LootDrop" WHERE id=$1', [otherDrop])).rowCount,
  ).toBe(1);
});

test("removing saved loot in the raid editor persists after reload", async ({ page, local }) => {
  const raidId = await local.addRaid();
  await page.goto(`/raids/${raidId}/edit`);
  await page.getByRole("button", { name: `Удалить ${local.item.name}`, exact: true }).click();
  await page.getByRole("button", { name: "Сохранить изменения", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Удалить и сохранить" }).click();
  await expect(page.getByText("Добычи пока нет")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Добычи пока нет")).toBeVisible();
  expect(
    (await local.db.query('SELECT id FROM "LootDrop" WHERE "raidId"=$1', [raidId])).rowCount,
  ).toBe(0);
});
