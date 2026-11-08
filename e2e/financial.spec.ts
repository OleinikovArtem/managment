import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { test, expect } from "./fixtures";
import { nextActionRequest, replayAction } from "./action-request";

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
    const requestPromise = nextActionRequest(page);
    await page.getByRole("button", { name: "Записать продажу", exact: true }).click();
    const request = await requestPromise;
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });
    expect(await replayAction(page, request)).toContain('"ok":true');
    expect(await replayAction(page, request, { quantitySold: 4 })).toContain('"ok":false');
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

  test("sale and payment replays are idempotent and conflicting payloads are rejected", async ({ page, context }) => {
    const partyId = (await context.cookies()).find((cookie) => cookie.name === "party-bank-active-party")!.value;
    await page.goto("/loot");
    await page.locator("article.loot-card").filter({ hasText: "E2E Raid 0" }).getByRole("button", { name: "Отметить продажу" }).click();
    await page.getByLabel("Полученная сумма Adena", { exact: true }).fill("10м");
    const saleRequest = nextActionRequest(page);
    await page.getByRole("button", { name: "Записать продажу", exact: true }).click();
    const sale = await saleRequest;
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });
    for (const result of await Promise.all([replayAction(page, sale), replayAction(page, sale)])) {
      expect(result).toContain('"ok":true');
    }
    expect(await replayAction(page, sale, { totalPrice: "11000000" })).toContain('"ok":false');
    expect((await pool.query('SELECT "totalPrice" FROM "SaleTransaction" WHERE "partyId"=$1', [partyId])).rows).toEqual([{ totalPrice: "10000000" }]);
    expect((await pool.query('SELECT amount FROM "SaleShare" WHERE "partyId"=$1', [partyId])).rows).toEqual([{ amount: "5000000" }, { amount: "5000000" }]);

    await page.goto("/sales");
    await page.getByRole("button", { name: /^Оформить передачу Adena участнику Player0:/ }).click();
    await page.getByLabel("Сумма передачи Adena для Player0", { exact: true }).fill("3");
    const paymentRequest = nextActionRequest(page);
    await page.getByRole("button", { name: "Записать передачу", exact: true }).click();
    const payment = await paymentRequest;
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });
    for (const result of await Promise.all([replayAction(page, payment), replayAction(page, payment)])) {
      expect(result).toContain('"ok":true');
    }
    expect(await replayAction(page, payment, { amount: "4000000" })).toContain('"ok":false');
    expect((await pool.query('SELECT amount FROM "MemberPayment" WHERE "partyId"=$1', [partyId])).rows).toEqual([{ amount: "3000000" }]);
    expect((await pool.query('SELECT amount FROM "PaymentAllocation" WHERE "partyId"=$1', [partyId])).rows).toEqual([{ amount: "3000000" }]);
    const balances = await pool.query('SELECT "accountType", SUM(debit-credit)::text AS net FROM "LedgerEntry" WHERE "partyId"=$1 GROUP BY "accountType" ORDER BY "accountType"::text', [partyId]);
    expect(balances.rows).toEqual([{ accountType: "MEMBER_PAYABLE", net: "-7000000" }, { accountType: "PARTY_CASH", net: "7000000" }]);
    await page.reload();
    await expect(page.locator('[title="2000000 Adena"]')).toBeVisible({ timeout: 30_000 });
  });

  test("two tabs selling the last item commit exactly one sale", async ({ page, context }) => {
    const partyId = (await context.cookies()).find((cookie) => cookie.name === "party-bank-active-party")!.value;
    await pool.query('UPDATE "LootDrop" SET quantity=1 WHERE id=$1', [`${partyId}-drop-0`]);
    const second = await context.newPage();
    try {
      for (const tab of [page, second]) {
        await tab.goto("/loot");
        await tab.locator("article.loot-card").filter({ hasText: "E2E Raid 0" }).getByRole("button", { name: "Отметить продажу" }).click();
        await tab.getByLabel("Полученная сумма Adena", { exact: true }).fill("10м");
      }
      // Both stale forms must reach the transport barrier before either is sent.
      let arrived = 0;
      let release!: () => void;
      const gate = new Promise<void>((resolve) => { release = resolve; });
      const gateTimeout = setTimeout(release, 15_000);
      for (const tab of [page, second]) {
        await tab.route("**/loot", async (route) => {
          if (route.request().method() === "POST" && route.request().headers()["next-action"]) {
            if (++arrived === 2) release();
            await gate;
          }
          await route.continue();
        });
      }
      await Promise.all([page, second].map((tab) => tab.getByRole("button", { name: "Записать продажу", exact: true }).click()));
      await expect.poll(() => arrived, { timeout: 20_000 }).toBe(2);
      clearTimeout(gateTimeout);
      await expect.poll(async () => {
        const dialogs = await Promise.all([page, second].map((tab) => tab.getByRole("dialog").count()));
        return dialogs.reduce((sum, count) => sum + count, 0);
      }, { timeout: 30_000 }).toBe(1);
      const losingTab = await page.getByRole("dialog").count() ? page : second;
      await expect(losingTab.getByRole("dialog").getByRole("alert")).toContainText("превышает оставшееся количество", { timeout: 30_000 });
      const sales = await pool.query('SELECT "quantitySold","totalPrice" FROM "SaleTransaction" WHERE "partyId"=$1', [partyId]);
      expect(sales.rows).toEqual([{ quantitySold: 1, totalPrice: "10000000" }]);
      expect((await pool.query('SELECT SUM(amount)::text AS total, COUNT(*)::int AS count FROM "SaleShare" WHERE "partyId"=$1', [partyId])).rows).toEqual([{ total: "10000000", count: 2 }]);
      expect((await pool.query('SELECT COUNT(*)::int AS count FROM "LedgerTransaction" WHERE "partyId"=$1', [partyId])).rows).toEqual([{ count: 1 }]);
      for (const tab of [page, second]) {
        await tab.reload();
        await expect(tab.locator("article.loot-card").filter({ hasText: "E2E Raid 0" }).getByRole("button", { name: "Отметить продажу" })).toHaveCount(0);
      }
    } finally { await second.close(); }
  });

  test("member profile and composition edits preserve raid snapshots and posted shares", async ({ page, context }) => {
    const partyId = (await context.cookies()).find((cookie) => cookie.name === "party-bank-active-party")!.value;
    const memberId = `${partyId}-member-0`;
    const raidId = `${partyId}-raid-0`;
    const profileId = `${partyId}-profile`;
    const compositionId = `${partyId}-composition`;
    await pool.query('UPDATE "PartyMember" SET "className"=\'Cardinal\' WHERE id=$1', [memberId]);
    await pool.query('INSERT INTO "PartyMemberProfile" (id,"partyId","memberId",name,"className","subclassSlot","updatedAt") VALUES ($1,$2,$3,\'Subclass 3\',\'Duelist\',3,NOW())', [profileId, partyId, memberId]);
    await pool.query('INSERT INTO "PartyComposition" (id,"partyId",name,"updatedAt") VALUES ($1,$2,\'Historical Composition\',NOW())', [compositionId, partyId]);
    for (const n of [0, 1]) {
      await pool.query('INSERT INTO "PartyCompositionMember" (id,"partyId","compositionId","memberId","profileId","slotOrder") VALUES ($1,$2,$3,$4,$5,$6)', [`${partyId}-slot-${n}`, partyId, compositionId, `${partyId}-member-${n}`, n === 0 ? profileId : null, n]);
    }
    await pool.query('UPDATE "Raid" SET "compositionId"=$1 WHERE id=$2', [compositionId, raidId]);
    await pool.query('UPDATE "RaidParticipant" SET "profileId"=$1,"classSnapshot"=\'Duelist\',"profileSnapshot"=\'Subclass 3\',"distributionWeight"=3 WHERE "raidId"=$2 AND "memberId"=$3', [profileId, raidId, memberId]);
    const snapshotSql = 'SELECT id,"memberId","nicknameSnapshot","profileId","classSnapshot","profileSnapshot",status,"distributionWeight" FROM "RaidParticipant" WHERE "raidId"=$1 ORDER BY id';
    const originalSnapshots = (await pool.query(snapshotSql, [raidId])).rows;
    await page.goto("/loot");
    await page.locator("article.loot-card").filter({ hasText: "E2E Raid 0" }).getByRole("button", { name: "Отметить продажу" }).click();
    await page.getByLabel("Полученная сумма Adena", { exact: true }).fill("10м");
    await page.getByRole("button", { name: "Записать продажу", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });
    const shareSql = 'SELECT id,"memberId","nicknameSnapshot","weightSnapshot",amount FROM "SaleShare" WHERE "partyId"=$1 ORDER BY id';
    const originalShares = (await pool.query(shareSql, [partyId])).rows;
    expect(originalShares).toHaveLength(2);
    expect(originalShares.map((row) => row.amount)).toEqual(["5000000", "5000000"]);
    expect(originalShares.find((row) => row.memberId === memberId).weightSnapshot).toBe(3);
    await page.goto("/sales");
    await page.getByRole("button", { name: /^Оформить передачу Adena участнику Player0:/ }).click();
    await page.getByLabel("Сумма передачи Adena для Player0", { exact: true }).fill("2");
    await page.getByRole("button", { name: "Записать передачу", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });
    const paymentSql = 'SELECT id,"nicknameSnapshot",amount FROM "MemberPayment" WHERE "partyId"=$1 ORDER BY id';
    const originalPayments = (await pool.query(paymentSql, [partyId])).rows;
    expect(originalPayments).toHaveLength(1);
    expect(originalPayments[0]).toMatchObject({ nicknameSnapshot: "Player0", amount: "2000000" });

    await page.goto("/members");
    await page.getByRole("button", { name: "Действия: Player0", exact: true }).click();
    await page.getByRole("menuitem", { name: "Изменить участника", exact: true }).click();
    await page.getByLabel("Игровой ник", { exact: true }).fill("RenamedPlayer");
    await page.getByRole("combobox", { name: "Main", exact: true }).fill("Archmage");
    await page.getByRole("option", { name: /Archmage/ }).click();
    await page.getByRole("button", { name: "Очистить: Subclass 3", exact: true }).click();
    await page.getByRole("button", { name: "Сохранить", exact: true }).click();
    await expect(page.getByRole("button", { name: "Действия: RenamedPlayer", exact: true })).toBeVisible({ timeout: 30_000 });
    expect((await pool.query('SELECT "isActive" FROM "PartyMemberProfile" WHERE id=$1', [profileId])).rows[0].isActive).toBe(false);
    await page.goto("/compositions");
    await page.getByRole("button", { name: "Действия состава Historical Composition", exact: true }).click();
    await page.getByRole("menuitem", { name: "Изменить состав", exact: true }).click();
    await page.getByRole("checkbox", { name: "Добавить RenamedPlayer в состав", exact: true }).uncheck();
    await page.getByRole("checkbox", { name: "Добавить Player2 в состав", exact: true }).check();
    await page.getByRole("button", { name: "Сохранить состав", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Изменить состав", exact: true })).toHaveCount(0, { timeout: 30_000 });
    expect((await pool.query('SELECT "memberId" FROM "PartyCompositionMember" WHERE "compositionId"=$1 ORDER BY "memberId"', [compositionId])).rows).toEqual([{ memberId: `${partyId}-member-1` }, { memberId: `${partyId}-member-2` }]);
    expect((await pool.query(snapshotSql, [raidId])).rows).toEqual(originalSnapshots);
    expect((await pool.query(shareSql, [partyId])).rows).toEqual(originalShares);
    expect((await pool.query(paymentSql, [partyId])).rows).toEqual(originalPayments);
    await page.goto(`/raids/${raidId}`);
    await expect(page.getByText("Player0", { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Duelist", { exact: true })).toBeVisible();
    await expect(page.getByText("RenamedPlayer", { exact: true })).toHaveCount(0);
    // A later sale must still use the original raid roster, names and metadata.
    await page.goto("/loot");
    await page.locator("article.loot-card").filter({ hasText: "E2E Raid 0" }).getByRole("button", { name: "Отметить продажу" }).click();
    await page.getByLabel("Полученная сумма Adena", { exact: true }).fill("10м");
    await page.getByRole("button", { name: "Записать продажу", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });
    const allShares = (await pool.query(shareSql, [partyId])).rows;
    expect(allShares).toHaveLength(4);
    expect(allShares.filter((row) => row.memberId === memberId).map((row) => ({ nickname: row.nicknameSnapshot, weight: row.weightSnapshot, amount: row.amount }))).toEqual([
      { nickname: "Player0", weight: 3, amount: "5000000" }, { nickname: "Player0", weight: 3, amount: "5000000" },
    ]);
    expect(allShares.some((row) => row.memberId === `${partyId}-member-2`)).toBe(false);
    await page.goto("/members");
    await page.getByRole("button", { name: "Действия: RenamedPlayer", exact: true }).click();
    await page.getByRole("menuitem", { name: "Деактивировать", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Деактивировать", exact: true }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0, { timeout: 30_000 });
    expect((await pool.query('SELECT "isActive" FROM "PartyMember" WHERE id=$1', [memberId])).rows[0].isActive).toBe(false);
    expect((await pool.query(snapshotSql, [raidId])).rows).toEqual(originalSnapshots);
    expect((await pool.query(shareSql, [partyId])).rows).toEqual(allShares);
    expect((await pool.query(paymentSql, [partyId])).rows).toEqual(originalPayments);
    const csv = await page.request.get("/api/ledger/export");
    expect(csv.status()).toBe(200);
    expect(await csv.text()).toContain("Player0");
    expect(await csv.text()).not.toContain("RenamedPlayer");
  });
});
