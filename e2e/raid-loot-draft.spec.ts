import { randomUUID } from "node:crypto";
import { test, expect } from "./local-fixtures";

test("new raid keeps loot through reload, isolates drafts and clears them explicitly or after creation", async ({
  page,
  local,
  context,
  baseURL,
}, info) => {
  const [item] = (
    await local.db.query(
      `SELECT id, COALESCE(NULLIF("displayName",''),"canonicalName") AS name FROM "Item"
       WHERE "partyId" IS NULL AND "isActive" ORDER BY "normalizedName","canonicalName" OFFSET 40 LIMIT 1`,
    )
  ).rows;
  expect(item, "An active item outside the initial catalog batch is required").toBeTruthy();

  async function addItem() {
    await page.getByRole("tab", { name: "Все предметы" }).click();
    await page.getByRole("textbox", { name: "Поиск по каталогу" }).fill(item.name);
    await page.getByRole("button", { name: `Добавить ${item.name}`, exact: true }).click();
  }

  const clear = page.getByRole("button", { name: "Очистить список", exact: true });
  const quantity = page.getByLabel(`Количество ${item.name}`, { exact: true });
  const picked = page.locator(".raid-loot-tile.is-selected");
  const comment = page.getByLabel(`Комментарий ${item.name}`, { exact: true });
  const screenshot = { animations: "disabled", style: "nextjs-portal { display: none; }" } as const;
  const openComment = () => picked.getByText("Комментарий", { exact: true }).click();
  const draftKey = `party-bank:raid-loot:v1:${local.userId}:${local.partyId}`;
  const storedDraft = () => page.evaluate((key) => localStorage.getItem(key), draftKey);

  await page.goto("/raids/new");
  await expect(clear).toBeDisabled();
  await addItem();
  await quantity.fill("7");
  await openComment();
  await comment.fill("Черновик добычи");
  expect(JSON.parse((await storedDraft())!)).toEqual([
    { itemId: item.id, quantity: 7, comment: "Черновик добычи" },
  ]);
  await page.reload();
  await expect(quantity).toHaveValue("7");
  await openComment();
  await expect(comment).toHaveValue("Черновик добычи");
  await picked.scrollIntoViewIfNeeded();
  await page.screenshot({ ...screenshot, path: info.outputPath("raid-loot-draft-desktop.png") });

  const otherParty = `e2e-draft-${randomUUID()}`;
  await local.db.query('INSERT INTO "Party" (id,name,"updatedAt") VALUES ($1,$1,NOW())', [
    otherParty,
  ]);
  await local.db.query(
    'INSERT INTO "PartyMembership" (id,"partyId","userId",role) VALUES ($1,$1,$2,\'OWNER\')',
    [otherParty, local.userId],
  );
  const selectParty = (value: string) =>
    context.addCookies([
      { name: "party-bank-active-party", value, url: baseURL!, httpOnly: true, sameSite: "Lax" },
    ]);
  await selectParty(otherParty);
  await page.reload();
  await expect(clear).toBeDisabled();
  await expect(picked).toHaveCount(0);
  await selectParty(local.partyId);
  await page.reload();
  await expect(quantity).toHaveValue("7");

  await quantity.fill("");
  await page.reload();
  await expect(quantity).toHaveValue("");
  await page.getByRole("button", { name: "Создать рейд" }).click();
  await expect(page.getByText(/Проверьте количества/)).toBeVisible();
  expect(
    (await local.db.query('SELECT id FROM "Raid" WHERE "partyId"=$1', [local.partyId])).rowCount,
  ).toBe(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await clear.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("alertdialog", { name: "Очистить список добычи?" });
  await expect(dialog).toBeInViewport();
  await page.screenshot({ ...screenshot, path: info.outputPath("raid-loot-clear-mobile.png") });
  await page.keyboard.press("Escape");
  await expect(clear).toBeFocused();
  await expect(quantity).toBeVisible();
  await clear.click();
  await dialog.getByRole("button", { name: "Очистить", exact: true }).click();
  await expect(picked).toHaveCount(0);
  expect(await storedDraft()).toBeNull();
  await page.reload();
  await expect(clear).toBeDisabled();
  await expect(picked).toHaveCount(0);

  await addItem();
  await quantity.fill("3");
  await openComment();
  await comment.fill("  Добыча для похода  ");
  await page.getByRole("button", { name: "Создать рейд" }).click();
  await expect(page.getByRole("link", { name: item.name, exact: true })).toBeVisible();
  const raidId = new URL(page.url()).pathname.split("/").at(-1);
  expect(
    (
      await local.db.query(
        'SELECT "itemId",quantity,comment FROM "LootDrop" WHERE "partyId"=$1 AND "raidId"=$2',
        [local.partyId, raidId],
      )
    ).rows,
  ).toEqual([{ itemId: item.id, quantity: 3, comment: "Добыча для похода" }]);
  expect(await storedDraft()).toBeNull();

  await page.goto("/raids/new");
  await expect(clear).toBeDisabled();
  await expect(picked).toHaveCount(0);
  await local.db.query('UPDATE "PartyMembership" SET role=\'MEMBER\' WHERE "partyId"=$1', [
    local.partyId,
  ]);
  await page.goto("/raids/new");
  await expect(page).toHaveURL(/\/dashboard$/);
});
