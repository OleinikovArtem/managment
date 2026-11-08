import { test, expect } from "./local-fixtures";
import { nextActionRequest, replayArguments } from "./action-request";

test("own item can be created, edited and archived while shared items remain immutable", async ({ page, local }) => {
  const name = `P1 Item ${local.partyId}`;
  const sharedBefore = (await local.db.query('SELECT * FROM "Item" WHERE id=$1', [local.item.id])).rows[0];
  await page.goto("/items");
  await page.getByRole("button", { name: "Добавить предмет", exact: true }).click();
  await page.getByLabel(/Оригинальное название/).fill(name);
  await page.getByRole("button", { name: "Добавить в каталог", exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible({ timeout: 30_000 });
  const itemId = new URL(page.url()).pathname.split("/").at(-1)!;
  expect((await local.db.query('SELECT "partyId" FROM "Item" WHERE id=$1', [itemId])).rows[0].partyId).toBe(local.partyId);
  await page.goto(`/items?q=${encodeURIComponent(name)}`);
  await page.getByRole("button", { name: `Действия: ${name}`, exact: true }).click();
  await page.getByRole("menuitem", { name: "Изменить предмет", exact: true }).click();
  await page.getByLabel(/Оригинальное название/).fill(`${name} Edited`);
  const requestPromise = nextActionRequest(page);
  await page.locator("form").getByRole("button", { name: "Сохранить", exact: true }).click();
  const request = await requestPromise;
  await expect(page.getByRole("heading", { name: "Изменить предмет", exact: true })).toHaveCount(0, { timeout: 30_000 });
  const args = JSON.parse(request.postData()!);
  args[0] = local.item.id;
  expect(await replayArguments(page, request, args)).toContain('"ok":false');
  expect((await local.db.query('SELECT * FROM "Item" WHERE id=$1', [local.item.id])).rows[0]).toEqual(sharedBefore);
  await page.goto(`/items?q=${encodeURIComponent(local.item.canonicalName)}`);
  await expect(page.getByRole("button", { name: `Действия: ${local.item.name}`, exact: true })).toHaveCount(0);
  await page.goto(`/items?q=${encodeURIComponent(name)}`);
  await page.getByRole("button", { name: `Действия: ${name} Edited`, exact: true }).click();
  await page.getByRole("menuitem", { name: "В архив", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "В архив", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0, { timeout: 30_000 });
  expect((await local.db.query('SELECT "isActive" FROM "Item" WHERE id=$1', [itemId])).rows[0].isActive).toBe(false);
  await page.goto(`/items/${itemId}`);
  await expect(page.getByRole("heading", { name: `${name} Edited`, exact: true })).toBeVisible();
  await page.goto(`/items?q=${encodeURIComponent(name)}`);
  await page.getByRole("button", { name: `Действия: ${name} Edited`, exact: true }).click();
  await page.getByRole("menuitem", { name: "Восстановить", exact: true }).click();
  await expect.poll(async () => (await local.db.query('SELECT "isActive" FROM "Item" WHERE id=$1', [itemId])).rows[0].isActive).toBe(true);
  // Own items remain scoped even when their exact ID is known.
  await local.db.query('UPDATE "PartyMembership" SET role=\'MEMBER\' WHERE "partyId"=$1', [local.partyId]);
  await page.goto("/items");
  await expect(page.getByRole("button", { name: "Добавить предмет", exact: true })).toHaveCount(0);
  await page.goto("/parties");
  await page.getByRole("button", { name: "Открыть", exact: true }).first().click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
  await page.goto(`/items/${itemId}`);
  await expect(page.getByRole("heading", { name: "Запись не найдена" })).toBeVisible({ timeout: 30_000 });
});

test("custom instance lifecycle and presets do not change existing raid loot", async ({ page, local }) => {
  const raidId = await local.addRaid(3);
  await page.goto("/raids/new");
  await page.getByRole("button", { name: "Свой инстанс", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Название", { exact: true }).fill("P1 Custom Instance");
  await dialog.getByRole("button", { name: "Добавить инстанс", exact: true }).click();
  await expect(dialog).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByRole("combobox", { name: "Инстанс", exact: true })).toHaveValue("P1 Custom Instance");
  await page.getByRole("button", { name: "Настроить", exact: true }).click();
  await page.getByRole("textbox", { name: "Найти предмет для набора" }).fill(local.item.canonicalName);
  await dialog.getByRole("checkbox", { name: local.item.name, exact: true }).check();
  await dialog.getByRole("button", { name: "Сохранить набор", exact: true }).click();
  await expect(dialog).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByRole("button", { name: `Добавить ${local.item.name}`, exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("tab", { name: "Быстрый", exact: true }).click();
  await page.getByRole("button", { name: "Настроить", exact: true }).click();
  await page.getByRole("textbox", { name: "Найти предмет для набора" }).fill(local.item.canonicalName);
  await dialog.getByRole("checkbox", { name: local.item.name, exact: true }).check();
  await dialog.getByRole("button", { name: "Сохранить набор", exact: true }).click();
  await expect(dialog).toHaveCount(0, { timeout: 30_000 });
  await page.getByRole("button", { name: "Мои инстансы", exact: true }).click();
  page.once("dialog", (prompt) => prompt.accept("P1 Renamed Instance"));
  await dialog.getByRole("button", { name: "Переименовать", exact: true }).click();
  await expect(dialog.getByText("P1 Renamed Instance", { exact: true })).toBeVisible({ timeout: 30_000 });
  await dialog.getByRole("button", { name: "В архив", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "В архив", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Восстановить", exact: true })).toBeVisible({ timeout: 30_000 });
  await dialog.getByRole("button", { name: "Восстановить", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "В архив", exact: true })).toBeVisible({ timeout: 30_000 });
  const instance = (await local.db.query('SELECT id,"isActive" FROM "Instance" WHERE "partyId"=$1', [local.partyId])).rows[0];
  expect(instance.isActive).toBe(true);
  expect((await local.db.query('SELECT "itemId" FROM "PartyQuickLootItem" WHERE "partyId"=$1', [local.partyId])).rows).toEqual([{ itemId: local.item.id }]);
  const preset = (await local.db.query('SELECT "itemId" FROM "PartyInstanceLootPresetItem" WHERE "partyId"=$1', [local.partyId])).rows;
  expect(preset).toEqual([{ itemId: local.item.id }]);
  expect((await local.db.query('SELECT quantity FROM "LootDrop" WHERE "raidId"=$1', [raidId])).rows).toEqual([{ quantity: 3 }]);
});

test("party default and draft Stage are independent and recommendations follow the draft", async ({ page, local }) => {
  const stages = (await local.db.query('SELECT id,name FROM "ServerStage" WHERE "isSelectable" AND "publishedAt" IS NOT NULL ORDER BY sequence')).rows;
  expect(stages.length, "Existing local published stages are required").toBeGreaterThanOrEqual(2);
  await page.goto("/settings");
  await page.getByLabel(/^По умолчанию/).selectOption(stages[0].id);
  const form = page.locator("form").filter({ has: page.getByLabel(/^По умолчанию/) });
  await form.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect.poll(async () => (await local.db.query('SELECT "selectedStageId" FROM "Party" WHERE id=$1', [local.partyId])).rows[0].selectedStageId).toBe(stages[0].id);
  await page.goto("/raids/new");
  const picker = page.locator(".raid-stage-button");
  await expect(picker).toHaveText(stages[0].name);
  const recommendation = (await local.db.query('SELECT r."itemId",i."canonicalName",COALESCE(NULLIF(i."displayName",\'\'),i."canonicalName") AS name, inst."displayName" AS instance FROM "InstanceStageLootRecommendation" r JOIN "Item" i ON i.id=r."itemId" JOIN "Instance" inst ON inst.id=r."instanceId" WHERE r."stageId"=$1 AND i."isActive" AND inst."isActive" ORDER BY r."sortOrder" LIMIT 1', [stages[0].id])).rows[0];
  expect(recommendation, "Published local Stage must have a recommendation").toBeTruthy();
  await page.getByRole("combobox", { name: "Инстанс", exact: true }).fill(recommendation.instance);
  await page.getByRole("listbox").getByRole("option").filter({ hasText: recommendation.instance }).click();
  await page.getByRole("button", { name: `Добавить ${recommendation.name}`, exact: true }).click();
  await picker.click();
  await page.locator(`[data-stage-id="${stages[1].id}"]`).click();
  await expect(picker).toHaveText(stages[1].name);
  await expect(page.getByLabel(`Количество ${recommendation.name}`, { exact: true })).toHaveValue("1");
  expect((await local.db.query('SELECT "selectedStageId" FROM "Party" WHERE id=$1', [local.partyId])).rows[0].selectedStageId).toBe(stages[0].id);
  await page.getByRole("button", { name: "Создать рейд", exact: true }).click();
  await expect(page).toHaveURL(/\/raids\/(?!new$)[^/]+$/, { timeout: 30_000 });
  const raidId = new URL(page.url()).pathname.split("/").at(-1);
  expect((await local.db.query('SELECT "stageId" FROM "Raid" WHERE id=$1', [raidId])).rows[0].stageId).toBe(stages[1].id);
});

test("stale draft Stage revision is rejected and the draft survives refresh and retry", async ({ page, local }) => {
  const stage = (await local.db.query('SELECT id,name,revision FROM "ServerStage" WHERE "isSelectable" AND "publishedAt" IS NOT NULL ORDER BY sequence LIMIT 1')).rows[0];
  expect(stage, "Local published Stage is required").toBeTruthy();
  await page.goto("/raids/new");
  await page.locator(".raid-stage-button").click();
  await page.locator(`[data-stage-id="${stage.id}"]`).click();
  await page.getByText("Своё название", { exact: false }).click();
  await page.getByLabel("Название рейда", { exact: true }).fill("P1 Retry Draft");
  await expect(page.getByRole("button", { name: "Создать рейд", exact: true })).toBeEnabled({ timeout: 30_000 });
  let changed = false;
  await page.route("**/raids/new", async (route) => {
    const request = route.request();
    if (!changed && request.method() === "POST" && request.headers()["next-action"] && request.postData()?.startsWith("[")) {
      const args = JSON.parse(request.postData()!);
      if (args[0]?.creationKey) {
        changed = true;
        args[0].stageRevision = stage.revision + 100;
        await route.continue({ postData: JSON.stringify(args) });
        return;
      }
    }
    await route.continue();
  });
  await page.getByRole("button", { name: "Создать рейд", exact: true }).click();
  await expect(page.getByRole("button", { name: "Обновить рекомендации", exact: true })).toBeVisible({ timeout: 30_000 });
  expect(changed).toBe(true);
  expect((await local.db.query('SELECT id FROM "Raid" WHERE "partyId"=$1', [local.partyId])).rows).toHaveLength(0);
  await expect(page.getByLabel("Название рейда", { exact: true })).toHaveValue("P1 Retry Draft");
  await page.getByRole("button", { name: "Обновить рекомендации", exact: true }).click();
  await expect(page.getByRole("button", { name: "Создать рейд", exact: true })).toBeEnabled({ timeout: 30_000 });
  await page.getByRole("button", { name: "Создать рейд", exact: true }).click();
  await expect(page.getByRole("heading", { name: "P1 Retry Draft", exact: true })).toBeVisible({ timeout: 30_000 });
  expect((await local.db.query('SELECT "stageId","stageRevisionSnapshot" FROM "Raid" WHERE "partyId"=$1', [local.partyId])).rows).toEqual([{ stageId: stage.id, stageRevisionSnapshot: stage.revision }]);
});
