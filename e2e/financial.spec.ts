import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { test, expect } from "./fixtures";

// Use the existing local database/account and catalog. Keep generated groups for inspection.
test.describe("financial workflows", () => {
  let pool: Pool;
  test.beforeAll(() => {
    pool = new Pool({ connectionString: process.env.E2E_DATABASE_URL ?? process.env.TEST_DATABASE_URL });
  });
  test.afterAll(async () => { await pool?.end(); });

  async function seed() {
    const id = `e2e-${randomUUID()}`;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const user = (await client.query('SELECT id FROM "User" WHERE username=$1', [process.env.E2E_USERNAME])).rows[0];
      const item = (await client.query('SELECT id FROM "Item" WHERE "partyId" IS NULL AND "isActive"=true ORDER BY id LIMIT 1')).rows[0];
      if (!user || !item) throw new Error("Existing local user and active shared catalog item required.");
      await client.query('INSERT INTO "Party" (id,name,"updatedAt") VALUES ($1,$2,NOW())', [id, id]);
      await client.query('INSERT INTO "PartyMembership" (id,"partyId","userId",role) VALUES ($1,$2,$3,\'OWNER\')', [`${id}-membership`, id, user.id]);
      for (let n = 0; n < 3; n++) {
        await client.query('INSERT INTO "PartyMember" (id,"partyId",nickname,"normalizedNickname","updatedAt") VALUES ($1,$2,$3,$3,NOW())', [`${id}-member-${n}`, id, `Player${n}`]);
      }
      for (let r = 0; r < 2; r++) {
        await client.query('INSERT INTO "Raid" (id,"partyId",name,"occurredAt","updatedAt") VALUES ($1,$2,$3,$4,NOW())', [`${id}-raid-${r}`, id, `E2E Raid ${r}`, new Date(Date.UTC(2026, 0, r + 1))]);
        for (let n = 0; n < 3; n++) {
          await client.query('INSERT INTO "RaidParticipant" (id,"partyId","raidId","memberId","nicknameSnapshot",status,"distributionWeight") VALUES ($1,$2,$3,$4,$5,$6,1)', [`${id}-participant-${r}-${n}`, id, `${id}-raid-${r}`, `${id}-member-${n}`, `Player${n}`, n === 2 ? "ABSENT" : "PRESENT"]);
        }
        await client.query('INSERT INTO "LootDrop" (id,"partyId","raidId","itemId",quantity,"createdAt","updatedAt") VALUES ($1,$2,$3,$4,2,$5,NOW())', [`${id}-drop-${r}`, id, `${id}-raid-${r}`, item.id, new Date(Date.UTC(2026, 0, r + 1))]);
      }
      await client.query("COMMIT");
      return id;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }

  test.beforeEach(async ({ context, baseURL }) => {
    const partyId = await seed();
    await context.addCookies([{ name: "party-bank-active-party", value: partyId, url: baseURL!, httpOnly: true, sameSite: "Lax" }]);
  });

  test("partial sale distributes only to PRESENT, locks raid, and payment updates balances", async ({ page, context }) => {
    const partyId = (await context.cookies()).find((cookie) => cookie.name === "party-bank-active-party")!.value;
    await page.goto("/loot");
    const card = page.locator("article.loot-card").filter({ hasText: "E2E Raid 0" });
    await card.getByRole("button", { name: "Отметить продажу" }).click();
    await page.getByLabel("Полученная сумма Adena", { exact: true }).fill("10м");
    await page.getByRole("button", { name: "Записать продажу", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });
    const sales = await pool.query('SELECT id,"quantitySold","totalPrice" FROM "SaleTransaction" WHERE "partyId"=$1', [partyId]);
    expect(sales.rows).toHaveLength(1);
    expect(sales.rows[0]).toMatchObject({ quantitySold: 1, totalPrice: "10000000" });
    const shares = await pool.query('SELECT "nicknameSnapshot",amount FROM "SaleShare" WHERE "partyId"=$1 ORDER BY "nicknameSnapshot"', [partyId]);
    expect(shares.rows).toEqual([{ nicknameSnapshot: "Player0", amount: "5000000" }, { nicknameSnapshot: "Player1", amount: "5000000" }]);
    await page.goto(`/raids/${partyId}-raid-0/edit`);
    await expect(page.getByRole("heading", { name: "Рейд недоступен для редактирования" })).toBeVisible({ timeout: 30_000 });
    await page.goto("/sales");
    await page.getByRole("button", { name: /^Оформить передачу Adena участнику Player0:/ }).click();
    const amount = page.getByLabel("Сумма передачи Adena для Player0", { exact: true });
    await expect(amount).toHaveValue("5");
    await amount.fill("3");
    await page.getByRole("button", { name: "Записать передачу", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });
    await page.reload();
    await expect(page.locator('[title="2000000 Adena"]')).toBeVisible({ timeout: 30_000 });
    const payments = await pool.query('SELECT amount FROM "MemberPayment" WHERE "partyId"=$1', [partyId]);
    expect(payments.rows).toEqual([{ amount: "3000000" }]);
    const cash = await pool.query('SELECT SUM(debit-credit)::text AS balance FROM "LedgerEntry" WHERE "partyId"=$1 AND "accountType"=\'PARTY_CASH\'', [partyId]);
    expect(cash.rows[0].balance).toBe("7000000");
  });

  test("grouped sale consumes oldest drops first and preserves exact total", async ({ page, context }) => {
    const partyId = (await context.cookies()).find((cookie) => cookie.name === "party-bank-active-party")!.value;
    await page.goto("/loot?combine=1");
    await page.getByRole("button", { name: "Отметить продажу", exact: true }).click();
    await page.getByLabel("Проданное количество", { exact: true }).fill("3");
    await page.getByLabel("Полученная сумма Adena", { exact: true }).fill("31");
    await page.getByRole("button", { name: "Записать продажу", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });
    const sales = await pool.query('SELECT "lootDropId","quantitySold","totalPrice" FROM "SaleTransaction" WHERE "partyId"=$1 ORDER BY "lootDropId"', [partyId]);
    expect(sales.rows).toHaveLength(2);
    expect(sales.rows.map((row) => row.quantitySold)).toEqual([2, 1]);
    expect(sales.rows[0].lootDropId).toBe(`${partyId}-drop-0`);
    expect(sales.rows.reduce((total, row) => total + BigInt(row.totalPrice), 0n)).toBe(31n);
    const shares = await pool.query('SELECT SUM(amount)::text AS total FROM "SaleShare" WHERE "partyId"=$1', [partyId]);
    expect(shares.rows[0].total).toBe("31");
    await page.reload();
    await expect(page.locator("article.loot-card").getByText("Частично продано", { exact: true })).toBeVisible();
  });

  test("full sale supports suffixes, exact small payment prefill and intentional overpayment", async ({ page, context }) => {
    const partyId = (await context.cookies()).find((cookie) => cookie.name === "party-bank-active-party")!.value;
    await page.goto("/loot");
    await page.locator("article.loot-card").filter({ hasText: "E2E Raid 0" }).getByRole("button", { name: "Отметить продажу" }).click();
    await page.getByLabel("Проданное количество", { exact: true }).fill("99");
    // UI clamps overselling to the available quantity.
    await expect(page.getByLabel("Проданное количество", { exact: true })).toHaveValue("2");
    await page.getByLabel("Полученная сумма Adena", { exact: true }).fill("750к");
    await page.getByRole("button", { name: "Записать продажу", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });
    await page.reload();
    await expect(page.locator("article.loot-card").filter({ hasText: "E2E Raid 0" }).getByRole("button", { name: "Отметить продажу" })).toHaveCount(0);
    await page.goto("/sales");
    await page.getByRole("button", { name: /^Оформить передачу Adena участнику Player0:/ }).click();
    const amount = page.getByLabel("Сумма передачи Adena для Player0", { exact: true });
    await expect(amount).toHaveValue("0.375");
    await amount.fill("1");
    await page.getByRole("button", { name: "Записать передачу", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });
    await page.reload();
    await expect(page.locator('[title="-625000 Adena"]')).toBeVisible({ timeout: 30_000 });
    const payments = await pool.query('SELECT amount FROM "MemberPayment" WHERE "partyId"=$1', [partyId]);
    expect(payments.rows).toEqual([{ amount: "1000000" }]);
    const cash = await pool.query('SELECT SUM(debit-credit)::text AS balance FROM "LedgerEntry" WHERE "partyId"=$1 AND "accountType"=\'PARTY_CASH\'', [partyId]);
    expect(cash.rows[0].balance).toBe("-250000");
  });

  test("MEMBER can read loot but cannot open raid editor or sell", async ({ page, context }) => {
    const partyId = (await context.cookies()).find((cookie) => cookie.name === "party-bank-active-party")!.value;
    await pool.query('UPDATE "PartyMembership" SET role=\'MEMBER\' WHERE "partyId"=$1', [partyId]);
    await page.goto("/loot");
    await expect(page.locator("article.loot-card")).toHaveCount(2, { timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Отметить продажу" })).toHaveCount(0);
    await page.goto(`/raids/${partyId}-raid-0/edit`);
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
    const sales = await pool.query('SELECT id FROM "SaleTransaction" WHERE "partyId"=$1', [partyId]);
    expect(sales.rows).toHaveLength(0);
  });

  test("active party cookie cannot grant access without membership", async ({ page, context }) => {
    const partyId = (await context.cookies()).find((cookie) => cookie.name === "party-bank-active-party")!.value;
    await pool.query('DELETE FROM "PartyMembership" WHERE "partyId"=$1', [partyId]);
    const response = await page.request.get("/api/ledger/export");
    expect(response.status()).toBe(403);
    await page.goto(`/raids/${partyId}-raid-0`);
    await expect(page).toHaveURL(/\/parties(?:\?|$)/, { timeout: 30_000 });
  });
});
