import { test, expect } from "./local-fixtures";
import { sell } from "./financial-ui";

test("raid creation retries a lost committed response without duplicating the raid", async ({
  page,
  local,
}) => {
  await page.goto("/raids/new");
  await expect(page.getByRole("button", { name: "Создать рейд", exact: true })).toBeEnabled({
    timeout: 30_000,
  });
  await page.getByText("Своё название", { exact: false }).click();
  await page.getByLabel("Название рейда", { exact: true }).fill("P2 Network Raid");
  let failed = false;
  const keys: string[] = [];
  await page.route("**/raids/new", async (route) => {
    const request = route.request();
    if (
      request.method() === "POST" &&
      request.headers()["next-action"] &&
      request.postData()?.startsWith("[")
    ) {
      const args = JSON.parse(request.postData()!);
      if (args[0]?.creationKey) {
        keys.push(args[0].creationKey);
        if (!failed) {
          failed = true;
          expect((await route.fetch()).ok()).toBe(true);
          await route.abort("failed");
          return;
        }
      }
    }
    await route.continue();
  });
  await page.getByRole("button", { name: "Создать рейд", exact: true }).click();
  await expect(
    page.getByText(
      "Не удалось получить ответ. Повторите сохранение: ключ запроса защитит от дубликата.",
      { exact: true },
    ),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel("Название рейда", { exact: true })).toHaveValue("P2 Network Raid");
  const before = (await local.db.query('SELECT id FROM "Raid" WHERE "partyId"=$1', [local.partyId]))
    .rows;
  expect(before).toHaveLength(1);
  await page.getByRole("button", { name: "Создать рейд", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/raids/${before[0].id}(?:\\?.*)?$`), { timeout: 30_000 });
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  expect(
    (await local.db.query('SELECT id FROM "Raid" WHERE "partyId"=$1', [local.partyId])).rows,
  ).toEqual(before);
});

for (const operation of ["sale", "payment"] as const) {
  for (const phase of ["before-commit", "after-commit"] as const) {
    test(`${operation} retries ${phase} network failure with the same draft and key`, async ({
      page,
      local,
    }, testInfo) => {
      await local.addRaid();
      const path = operation === "sale" ? "/loot" : "/sales";
      if (operation === "payment") await sell(page);
      await page.goto(path);
      if (operation === "sale")
        await page.getByRole("button", { name: "Отметить продажу", exact: true }).click();
      else
        await page
          .getByRole("button", { name: /^Оформить передачу Adena участнику Hero0:/ })
          .click();
      const dialog = page.getByRole("dialog");
      const amount = dialog.getByLabel(
        operation === "sale" ? "Полученная сумма Adena" : "Сумма передачи Adena для Hero0",
        { exact: true },
      );
      const date = dialog.getByLabel(
        operation === "sale" ? "Дата получения Adena" : "Дата передачи Adena для Hero0",
        { exact: true },
      );
      await amount.fill(operation === "sale" ? "10м" : "3");
      const originalDate = await date.inputValue();
      await dialog.getByRole("button", { name: "Добавить комментарий", exact: true }).click();
      const comment = dialog.getByRole("textbox", {
        name:
          operation === "sale" ? "Комментарий к продаже" : "Комментарий к передаче Adena для Hero0",
        exact: true,
      });
      await comment.fill("P2 preserved draft");
      let failed = false;
      const keys: string[] = [];
      await page.route(`**${path}`, async (route) => {
        const request = route.request();
        if (request.method() === "POST" && request.headers()["next-action"]) {
          const args = JSON.parse(request.postData()!);
          keys.push(args[0].idempotencyKey);
          if (!failed) {
            failed = true;
            if (phase === "after-commit") {
              const response = await route.fetch();
              expect(response.ok()).toBe(true);
              expect(await response.text()).toContain('"ok":true');
            }
            await route.abort("failed");
            return;
          }
        }
        await route.continue();
      });
      const submit = dialog.getByRole("button", {
        name: operation === "sale" ? "Записать продажу" : "Записать передачу",
        exact: true,
      });
      await submit.click();
      await expect(dialog.getByRole("alert")).toContainText("Повторите", { timeout: 30_000 });
      await expect(amount).toHaveValue(operation === "sale" ? "10м" : "3");
      await expect(date).toHaveValue(originalDate);
      await expect(comment).toHaveValue("P2 preserved draft");
      const table = operation === "sale" ? "SaleTransaction" : "MemberPayment";
      expect(
        (
          await local.db.query(`SELECT COUNT(*)::int AS n FROM "${table}" WHERE "partyId"=$1`, [
            local.partyId,
          ])
        ).rows[0].n,
      ).toBe(phase === "after-commit" ? 1 : 0);
      if (phase === "after-commit")
        await page.screenshot({
          path: testInfo.outputPath(`${operation}-retry.png`),
          fullPage: true,
        });
      await submit.click();
      await expect(dialog).toHaveCount(0, { timeout: 30_000 });
      expect(keys).toHaveLength(2);
      expect(keys[0]).toBe(keys[1]);
      expect(
        (
          await local.db.query(`SELECT COUNT(*)::int AS n FROM "${table}" WHERE "partyId"=$1`, [
            local.partyId,
          ])
        ).rows[0].n,
      ).toBe(1);
      expect(
        (
          await local.db.query(
            'SELECT COUNT(*)::int AS n FROM "LedgerTransaction" WHERE "partyId"=$1',
            [local.partyId],
          )
        ).rows[0].n,
      ).toBe(operation === "sale" ? 1 : 2);
      await page.reload();
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: operation === "sale" ? "Лут" : "Финансы",
          exact: true,
        }),
      ).toBeVisible();
    });
  }
}
