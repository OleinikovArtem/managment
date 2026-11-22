import { randomBytes, createHash } from "node:crypto";
import { test, expect } from "./local-fixtures";

test("webhook authenticates source, imports once and MEMBER reads notifications", async ({ page, local }) => {
  await local.addRaid();
  const webhookId = randomBytes(24).toString("hex");
  const secret = randomBytes(24).toString("hex");
  await local.db.query('INSERT INTO "PartyTelegramBotConfig" ("partyId","encryptedToken","initializationVector","authenticationTag","webhookId","webhookSecretHash","webhookEnabled","chatId","senderId","updatedAt") VALUES ($1,\'e2e\',\'e2e\',\'e2e\',$2,$3,true,\'42\',\'77\',NOW())', [local.partyId, webhookId, createHash("sha256").update(secret).digest("hex")]);
  const text = `💰 Successful sale\nBuyer: E2E\nItems:\n• 🔹 ${local.item.canonicalName} × 2 @ 399 900 🔹 Adena\nTotal: 799 800 🔹 Adena\n💰 Current adena: 2 884 941\n\n🌞 Light x20 · 👤 A123`;
  const update = { update_id: 1, message: { message_id: 1, date: Math.floor(Date.now() / 1000), chat: { id: 42, type: "private" }, from: { id: 42, is_bot: false }, forward_origin: { type: "user", date: Math.floor(Date.now() / 1000) - 10, sender_user: { id: 77, is_bot: true, username: "BohPTSbot" } }, text } };
  const endpoint = `/api/telegram/webhook/${webhookId}`;
  expect((await page.request.post(endpoint, { data: update })).status()).toBe(403);
  const send = (data: unknown) => page.request.post(endpoint, { data, headers: { "X-Telegram-Bot-Api-Secret-Token": secret } });
  expect((await send({ ...update, message: { ...update.message, chat: { ...update.message.chat, id: -10043 } } })).status()).toBe(200);
  expect((await local.db.query('SELECT id FROM "SaleTransaction" WHERE "partyId"=$1', [local.partyId])).rows).toHaveLength(0);
  expect((await send(update)).status()).toBe(200);
  expect((await send(update)).status()).toBe(200);
  expect((await send({ ...update, update_id: 2, message: { ...update.message, message_id: 2 } })).status()).toBe(200);
  expect((await send({ update_id: 3, edited_message: { ...update.message, text: text.replace("399 900", "400 000").replace("799 800", "800 000") } })).status()).toBe(200);
  expect((await local.db.query('SELECT "quantitySold","totalPrice" FROM "SaleTransaction" WHERE "partyId"=$1', [local.partyId])).rows).toEqual([{ quantitySold: 2, totalPrice: "799800" }]);
  expect((await local.db.query('SELECT amount FROM "SaleShare" WHERE "partyId"=$1', [local.partyId])).rows).toEqual([{ amount: "399900" }, { amount: "399900" }]);
  await local.db.query('UPDATE "PartyMembership" SET role=\'MEMBER\' WHERE "partyId"=$1', [local.partyId]);
  await page.goto("/telegram");
  await expect(page.getByRole("region", { name: "Сообщения Telegram" }).getByText("Продажа учтена", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Повторить обработку", exact: true })).toHaveCount(0);
  await expect(page.getByText(/Соответствия названий предметов/)).toHaveCount(0);
  const unread = await page.request.get("/api/telegram/notifications");
  expect((await unread.json()).items).toHaveLength(1);
  await page.getByRole("button", { name: "Отметить прочитанными", exact: true }).click();
  await expect.poll(async () => (await (await page.request.get("/api/telegram/notifications")).json()).items.length).toBe(0);

  await local.db.query('UPDATE "PartyMembership" SET role=\'OWNER\' WHERE "partyId"=$1', [
    local.partyId,
  ]);
  const otherPartyId = `${local.partyId}-other-inbox`;
  await local.db.query('INSERT INTO "Party" (id,name,"updatedAt") VALUES ($1,$1,NOW())', [
    otherPartyId,
  ]);
  await local.db.query(
    'INSERT INTO "TelegramSaleImport" (id,"partyId","chatId","senderId","messageId","updateId","rawText","sourceHash",status,"receivedAt","updatedAt") SELECT $1,$1,"chatId","senderId","messageId","updateId","rawText","sourceHash",status,"receivedAt",NOW() FROM "TelegramSaleImport" WHERE "partyId"=$2 AND status=\'PROCESSED\'',
    [otherPartyId, local.partyId],
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/settings?tab=reset");
  await page.getByRole("checkbox", { name: /^Сообщения Telegram/ }).check();
  const preview = page.getByRole("listitem").filter({ hasText: "Сообщения Telegram" });
  await expect(preview).toHaveText(/Сообщения Telegram\s*2/);
  await expect(page.getByRole("checkbox", { name: /^Продажи/ })).not.toBeChecked();
  await page.screenshot({
    path: test.info().outputPath("telegram-reset-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("textbox", { name: /Введите вручную/ }).fill("Resset");
  await page.getByRole("button", { name: "Сбросить выбранное", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Сбросить выбранное", exact: true })
    .click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  expect((await send(update)).status()).toBe(200);
  expect(
    (
      await send({ ...update, update_id: 4, message: { ...update.message, message_id: 4 } })
    ).status(),
  ).toBe(200);
  await page.goto("/telegram");
  await expect(page.getByText("Уведомлений о продажах пока нет", { exact: true })).toBeVisible();
  expect((await (await page.request.get("/api/telegram/notifications")).json()).items).toHaveLength(
    0,
  );
  expect(
    (
      await local.db.query('SELECT "totalPrice" FROM "SaleTransaction" WHERE "partyId"=$1', [
        local.partyId,
      ])
    ).rows,
  ).toEqual([{ totalPrice: "799800" }]);
  expect(
    (await local.db.query('SELECT amount FROM "SaleShare" WHERE "partyId"=$1', [local.partyId]))
      .rows,
  ).toEqual([{ amount: "399900" }, { amount: "399900" }]);
  expect(
    (
      await local.db.query(
        'SELECT "rawText", status FROM "TelegramSaleImport" WHERE "partyId"=$1',
        [otherPartyId],
      )
    ).rows,
  ).toEqual([{ rawText: text, status: "PROCESSED" }]);
  expect(
    (
      await local.db.query(
        'SELECT "webhookEnabled" FROM "PartyTelegramBotConfig" WHERE "partyId"=$1',
        [local.partyId],
      )
    ).rows,
  ).toEqual([{ webhookEnabled: true }]);
});

test("failed multiline import is atomic, alias fixes retry and dismiss creates no sales", async ({ page, local }) => {
  await local.addRaid(10);
  const webhookId = randomBytes(24).toString("hex");
  const secret = randomBytes(24).toString("hex");
  await local.db.query('INSERT INTO "PartyTelegramBotConfig" ("partyId","encryptedToken","initializationVector","authenticationTag","webhookId","webhookSecretHash","webhookEnabled","chatId","senderId","updatedAt") VALUES ($1,\'e2e\',\'e2e\',\'e2e\',$2,$3,true,\'-10042\',\'77\',NOW())', [local.partyId, webhookId, createHash("sha256").update(secret).digest("hex")]);
  const alias = `P1 Unknown ${local.partyId}`;
  const text = `Successful sale\nItems:\n- ${local.item.canonicalName} × 1 @ 10 Adena\n- ${alias} × 1 @ 20 Adena\nTotal: 30 Adena`;
  const deliver = async (messageId: number) => {
    const response = await page.request.post(`/api/telegram/webhook/${webhookId}`, { headers: { "X-Telegram-Bot-Api-Secret-Token": secret }, data: { update_id: messageId, message: { message_id: messageId, date: Math.floor(Date.now() / 1000) + messageId, chat: { id: -10042, type: "supergroup" }, from: { id: 77, is_bot: true }, text } } });
    expect(response.status()).toBe(200);
  };
  await deliver(1);
  expect((await local.db.query('SELECT status FROM "TelegramSaleImport" WHERE "partyId"=$1', [local.partyId])).rows).toEqual([{ status: "NEEDS_REVIEW" }]);
  expect((await local.db.query('SELECT id FROM "SaleTransaction" WHERE "partyId"=$1', [local.partyId])).rows).toHaveLength(0);
  await page.goto("/telegram");
  await page.getByText(/Соответствия названий предметов/).click();
  await page.getByLabel("Название из Telegram", { exact: true }).fill(alias);
  await page.getByLabel("Предмет каталога", { exact: true }).selectOption(local.item.id);
  await page.getByRole("button", { name: "Сохранить соответствие", exact: true }).click();
  await expect.poll(async () => (await local.db.query('SELECT id FROM "TelegramItemAlias" WHERE "partyId"=$1', [local.partyId])).rows.length).toBe(1);
  await page.reload();
  await page.getByText("Исходное сообщение и повторный разбор", { exact: true }).click();
  await page.getByRole("button", { name: "Повторить обработку", exact: true }).click();
  await expect(page.getByRole("region", { name: "Сообщения Telegram" }).getByText("Продажа учтена", { exact: true })).toBeVisible({ timeout: 30_000 });
  expect((await local.db.query('SELECT SUM("totalPrice")::text AS total FROM "SaleTransaction" WHERE "partyId"=$1', [local.partyId])).rows[0].total).toBe("30");
  await page.getByText(/Соответствия названий предметов/).click();
  await page.getByRole("button", { name: "Удалить", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Удалить", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0, { timeout: 30_000 });
  await deliver(2);
  await page.reload();
  await page.getByText("Исходное сообщение и повторный разбор", { exact: true }).click();
  await page.getByRole("button", { name: "Исключить сообщение", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Исключить", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0, { timeout: 30_000 });
  expect((await local.db.query('SELECT status FROM "TelegramSaleImport" WHERE "partyId"=$1 ORDER BY "messageId"', [local.partyId])).rows).toEqual([{ status: "PROCESSED" }, { status: "IGNORED" }]);
  expect((await local.db.query('SELECT SUM("totalPrice")::text AS total FROM "SaleTransaction" WHERE "partyId"=$1', [local.partyId])).rows[0].total).toBe("30");
});
