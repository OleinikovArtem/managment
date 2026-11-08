import { randomUUID } from "node:crypto";
import { test, expect } from "./local-fixtures";
import { sell, pay } from "./financial-ui";
import { nextActionRequest, replayAction } from "./action-request";

// Parse quoted CSV cells independently of the application's serializer.
function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') {
        cell += '"';
        index++;
      } else quoted = !quoted;
    } else if (!quoted && char === ",") {
      row.push(cell);
      cell = "";
    } else if (!quoted && char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (quoted || char !== "\r") cell += char;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

test("ledger filters, operation details and downloaded CSV match complete database history", async ({
  page,
  local,
}) => {
  const raidId = await local.addRaid();
  const saleComment = '=sale, "quoted"\nsecond line';
  const paymentComment = '=payment, "quoted"\nsecond line';
  await sell(page, "9007199254740993", saleComment);
  await pay(page, "1.25", paymentComment);
  await page.goto("/ledger");
  const operations = page.locator(".finance-operation-list > li");
  await expect(operations).toHaveCount(2, { timeout: 30_000 });
  const sale = operations.filter({ hasText: local.item.name });
  await sale.locator("summary").click();
  await expect(sale.getByRole("heading", { name: "Доли участников", exact: true })).toBeVisible();
  await expect(sale.getByRole("link", { name: "P1 Fixture Raid", exact: true })).toHaveAttribute(
    "href",
    `/raids/${raidId}`,
  );
  await expect(sale.locator('[title="9007199254740993 Adena"]')).toBeVisible();
  await expect(sale.getByText("Hero0", { exact: true })).toBeVisible();
  await expect(sale.getByText("Hero1", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Передачи/ }).click();
  await expect(operations).toHaveCount(1);
  await operations.locator("summary").click();
  await expect(operations.getByText(paymentComment, { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Поиск операций" }).fill("second line");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Поиск операций" })).toHaveValue("second line");
  await expect(page.getByRole("button", { name: /^Передачи/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(operations).toHaveCount(1);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Экспорт всех операций", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("financial-history.csv");
  const stream = await download.createReadStream();
  if (!stream) throw new Error("CSV download stream unavailable");
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8");
  expect(text.charCodeAt(0)).toBe(0xfeff);
  const [header, ...rows] = parseCsv(text);
  expect(header).toEqual([
    "Операция",
    "Дата",
    "Предмет",
    "Рейд",
    "Количество",
    "Сумма Adena",
    "Участник",
    "Доля с продажи Adena",
    "Комментарий",
  ]);
  const sales = (
    await local.db.query(
      'SELECT to_char(s."receivedAt",\'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"\') AS date,s."totalPrice",s."quantitySold",sh."nicknameSnapshot",sh.amount FROM "SaleTransaction" s JOIN "SaleShare" sh ON sh."saleTransactionId"=s.id WHERE s."partyId"=$1',
      [local.partyId],
    )
  ).rows;
  const payment = (
    await local.db.query(
      'SELECT to_char("paidAt",\'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"\') AS date,amount,"nicknameSnapshot" FROM "MemberPayment" WHERE "partyId"=$1',
      [local.partyId],
    )
  ).rows[0];
  const expected = sales.map((row) => [
    "Продажа",
    row.date,
    local.item.name,
    "P1 Fixture Raid",
    String(row.quantitySold),
    row.totalPrice,
    row.nicknameSnapshot,
    row.amount,
    `'${saleComment}`,
  ]);
  expected.push([
    "Передача участнику",
    payment.date,
    "",
    "",
    "",
    payment.amount,
    payment.nicknameSnapshot,
    "",
    `'${paymentComment}`,
  ]);
  expect(rows.map((row) => JSON.stringify(row)).sort()).toEqual(
    expected.map((row) => JSON.stringify(row)).sort(),
  );
  expect(sales.reduce((sum, row) => sum + BigInt(row.amount), 0n)).toBe(9007199254740993n);
});

test("ledger pagination, search and empty results preserve URL state", async ({ page, local }) => {
  await local.addRaid();
  await sell(page, "100м");
  await page.goto("/sales");
  await page.getByRole("button", { name: /^Оформить передачу Adena участнику Hero0:/ }).click();
  await page.getByLabel("Сумма передачи Adena для Hero0", { exact: true }).fill("1");
  const requestPromise = nextActionRequest(page);
  await page.getByRole("button", { name: "Записать передачу", exact: true }).click();
  const request = await requestPromise;
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });
  for (let index = 0; index < 25; index++) {
    expect(await replayAction(page, request, { idempotencyKey: randomUUID() })).toContain(
      '"ok":true',
    );
  }
  await page.goto("/ledger");
  await expect(page.locator(".finance-operation-list > li")).toHaveCount(25, { timeout: 30_000 });
  await page
    .getByRole("navigation", { name: "Страницы операций" })
    .getByRole("button", { name: "Вперёд", exact: true })
    .click();
  await expect(page).toHaveURL(/page=2/);
  await page.reload();
  await expect(page.locator(".finance-operation-list > li")).toHaveCount(2, { timeout: 30_000 });
  await page.getByRole("textbox", { name: "Поиск операций" }).fill("no-matching-operation");
  await expect(
    page.getByText("Операций по этим условиям нет. Измените поиск или фильтр.", { exact: true }),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.has("page")).toBe(false);
  await page.getByRole("textbox", { name: "Поиск операций" }).fill("");
  await expect(page.locator(".finance-operation-list > li")).toHaveCount(25);
});
