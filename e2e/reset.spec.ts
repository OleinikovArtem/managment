import { randomUUID } from "node:crypto";
import { test, expect } from "./local-fixtures";

for (const [category, label] of [
  ["payments", "Выплаты участникам"], ["sales", "Продажи"], ["loot", "Лут рейдов"],
  ["raids", "Рейды"], ["compositions", "Сохранённые составы"], ["members", "Участники и профили"],
]) {
  test(`selective reset of ${category} respects dependencies and preserves catalogs and access`, async ({ page, local }) => {
    const raidId = await local.addRaid();
    const sentinelId = `${local.partyId}-unrelated`;
    await local.db.query('INSERT INTO "Party" (id,name,"updatedAt") VALUES ($1,$1,NOW())', [sentinelId]);
    await local.db.query('INSERT INTO "Raid" (id,"partyId",name,"occurredAt","updatedAt") VALUES ($1,$1,\'Unrelated Raid\',NOW(),NOW())', [sentinelId]);
    const compositionId = `${local.partyId}-composition`;
    await local.db.query('INSERT INTO "PartyComposition" (id,"partyId",name,"updatedAt") VALUES ($1,$2,\'Reset Composition\',NOW())', [compositionId, local.partyId]);
    await local.db.query('INSERT INTO "PartyCompositionMember" (id,"partyId","compositionId","memberId") VALUES ($1,$2,$3,$4)', [randomUUID(), local.partyId, compositionId, `${local.partyId}-member-0`]);
    await local.db.query('UPDATE "Raid" SET "compositionId"=$1 WHERE id=$2', [compositionId, raidId]);
    await local.db.query('INSERT INTO "Item" (id,"partyId","canonicalName","normalizedName","updatedAt") VALUES ($1,$2,$1,$1,NOW())', [`${local.partyId}-private-item`, local.partyId]);
    await local.db.query('INSERT INTO "TelegramSaleImport" (id,"partyId","chatId","senderId","messageId","updateId","rawText","sourceHash",status,"receivedAt","updatedAt") VALUES ($1,$2,\'42\',\'77\',\'1\',\'1\',\'fixture\',\'fixture\',\'NEEDS_REVIEW\',NOW(),NOW())', [`${local.partyId}-inbox`, local.partyId]);
    await local.db.query('INSERT INTO "PartyTelegramBotConfig" ("partyId","encryptedToken","initializationVector","authenticationTag","updatedAt") VALUES ($1,\'e2e\',\'e2e\',\'e2e\',NOW())', [local.partyId]);
    const catalogBefore = (await local.db.query('SELECT COUNT(*)::int AS n FROM "Item" WHERE "partyId" IS NULL')).rows[0].n;
    await page.goto("/loot");
    await page.getByRole("button", { name: "Отметить продажу", exact: true }).click();
    await page.getByLabel("Полученная сумма Adena", { exact: true }).fill("10м");
    await page.getByRole("button", { name: "Записать продажу", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });
    await page.goto("/sales");
    await page.getByRole("button", { name: /^Оформить передачу Adena участнику Hero0:/ }).click();
    await page.getByLabel("Сумма передачи Adena для Hero0", { exact: true }).fill("1");
    await page.getByRole("button", { name: "Записать передачу", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });
    await page.goto("/settings?tab=reset");
    const button = page.getByRole("button", { name: "Сбросить выбранное", exact: true });
    await expect(button).toBeDisabled();
    await page.getByRole("checkbox", { name: new RegExp(`^${label}`) }).check();
    const confirmation = page.getByRole("textbox", { name: /Введите вручную/ });
    await expect(confirmation).toBeEnabled({ timeout: 30_000 });
    if (["sales", "loot", "raids", "members"].includes(category)) {
      await expect(page.getByRole("checkbox", { name: /^Выплаты участникам/ })).toBeChecked();
      await expect(page.getByRole("checkbox", { name: /^Выплаты участникам/ })).toBeDisabled();
    }
    await confirmation.fill("wrong");
    await expect(button).toBeDisabled();
    if (category === "payments") {
      await confirmation.fill("Resset");
      await page.getByRole("checkbox", { name: /^Продажи/ }).check();
      await expect(confirmation).toHaveValue("");
      await expect(button).toBeDisabled();
      await page.getByRole("checkbox", { name: /^Продажи/ }).uncheck();
      await expect(confirmation).toBeEnabled({ timeout: 30_000 });
    }
    await confirmation.fill("Resset");
    await button.click();
    // Cancelling the final confirmation must preserve the financial history.
    await page.getByRole("alertdialog").getByRole("button", { name: "Отмена", exact: true }).click();
    expect((await local.db.query('SELECT COUNT(*)::int AS n FROM "SaleTransaction" WHERE "partyId"=$1', [local.partyId])).rows[0].n).toBe(1);
    await button.click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Сбросить выбранное", exact: true }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0, { timeout: 30_000 });
    const removed = new Set(category === "members" ? ["members", "compositions", "raids", "loot", "sales", "payments"] : category === "raids" ? ["raids", "loot", "sales", "payments"] : category === "loot" ? ["loot", "sales", "payments"] : category === "sales" ? ["sales", "payments"] : [category]);
    for (const [key, table, original] of [
      ["members", "PartyMember", 2], ["members", "PartyMemberProfile", 1], ["compositions", "PartyComposition", 1], ["raids", "Raid", 1],
      ["loot", "LootDrop", 1], ["sales", "SaleTransaction", 1], ["payments", "MemberPayment", 1],
    ] as const) {
      expect((await local.db.query(`SELECT COUNT(*)::int AS n FROM "${table}" WHERE "partyId"=$1`, [local.partyId])).rows[0].n, table).toBe(removed.has(key) ? 0 : original);
    }
    expect((await local.db.query('SELECT COUNT(*)::int AS n FROM "Item" WHERE "partyId" IS NULL')).rows[0].n).toBe(catalogBefore);
    expect((await local.db.query('SELECT COUNT(*)::int AS n FROM "Item" WHERE "partyId"=$1', [local.partyId])).rows[0].n).toBe(1);
    expect((await local.db.query('SELECT COUNT(*)::int AS n FROM "PartyMembership" WHERE "partyId"=$1', [local.partyId])).rows[0].n).toBe(1);
    expect((await local.db.query('SELECT COUNT(*)::int AS n FROM "PartyTelegramBotConfig" WHERE "partyId"=$1', [local.partyId])).rows[0].n).toBe(1);
    expect((await local.db.query('SELECT name FROM "Raid" WHERE "partyId"=$1', [sentinelId])).rows).toEqual([{ name: "Unrelated Raid" }]);
    expect((await local.db.query('SELECT status FROM "TelegramSaleImport" WHERE "partyId"=$1', [local.partyId])).rows).toEqual([{ status: removed.has("sales") ? "IGNORED" : "NEEDS_REVIEW" }]);
    expect((await local.db.query('SELECT COUNT(*)::int AS n FROM "SaleShare" WHERE "partyId"=$1', [local.partyId])).rows[0].n).toBe(removed.has("sales") ? 0 : 2);
    expect((await local.db.query('SELECT COUNT(*)::int AS n FROM "PaymentAllocation" WHERE "partyId"=$1', [local.partyId])).rows[0].n).toBe(removed.has("payments") ? 0 : 1);
    expect((await local.db.query('SELECT COUNT(*)::int AS n FROM "LedgerTransaction" WHERE "partyId"=$1', [local.partyId])).rows[0].n).toBe(removed.has("sales") ? 0 : removed.has("payments") ? 1 : 2);
    if (!removed.has("raids")) {
      const raid = (await local.db.query('SELECT "compositionId","lockedAt" FROM "Raid" WHERE id=$1', [raidId])).rows[0];
      expect(raid.compositionId).toBe(removed.has("compositions") ? null : compositionId);
      if (removed.has("sales")) expect(raid.lockedAt).toBeNull();
      else expect(raid.lockedAt).not.toBeNull();
    }
  });
}
