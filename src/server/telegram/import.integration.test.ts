import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const testUrl = process.env.TEST_DATABASE_URL;
let disconnect: (() => Promise<void>) | undefined;
afterAll(async () => {
  await disconnect?.();
});

describe.skipIf(!testUrl?.startsWith("postgres"))(
  "Telegram ingestion on disposable PostgreSQL",
  () => {
    it("accepts attributed human forwards in a selected group or private chat and deduplicates across both", async () => {
      process.env.DATABASE_URL = testUrl;
      const [{ prisma }, { receiveTelegramUpdate }] = await Promise.all([
        import("@/lib/db/prisma"),
        import("./import-service"),
      ]);
      disconnect = () => prisma.$disconnect();
      const partyId = `telegram-forward-${randomUUID()}`;
      const webhookId = randomBytes(24).toString("hex");
      await prisma.party.create({ data: { id: partyId, name: "Forwarded sales" } });
      await prisma.partyTelegramBotConfig.create({
        data: {
          partyId,
          encryptedToken: "test",
          initializationVector: "test",
          authenticationTag: "test",
          webhookId,
          webhookEnabled: true,
          botId: String(Date.now()),
        },
      });
      const itemName = `Forward Boots ${randomUUID()}`;
      const item = await prisma.item.create({
        data: { canonicalName: itemName, normalizedName: itemName.toLowerCase() },
      });
      const member = await prisma.partyMember.create({
        data: { partyId, nickname: "Forward Member", normalizedNickname: "forward member" },
      });
      const raid = await prisma.raid.create({
        data: { partyId, name: "Forward Raid", occurredAt: new Date("2026-11-01T10:00:00Z") },
      });
      await prisma.raidParticipant.create({
        data: {
          partyId,
          raidId: raid.id,
          memberId: member.id,
          nicknameSnapshot: member.nickname,
          status: "PRESENT",
          distributionWeight: 3,
        },
      });
      await prisma.lootDrop.create({
        data: { partyId, raidId: raid.id, itemId: item.id, quantity: 10 },
      });
      const text = `💰 Successful sale\nBuyer: Love\nItems:\n- 🥾 ${itemName} × 1 @ 22 222 222 💰 Adena\nTotal: 22 222 222 💰 Adena\n💰 Current adena: 854 896 093\n🌟 Phenomenon x20 · 👤 Miva`;
      const originalDate = 1793960000;
      const origin = {
        type: "user",
        date: originalDate,
        sender_user: { id: 77, is_bot: true, username: "BoHpts_bot" },
      };
      let updateId = 0;
      const deliver = (messageId: number, extra: object = {}) =>
        receiveTelegramUpdate(webhookId, {
          update_id: ++updateId,
          message: {
            message_id: messageId,
            date: originalDate + 500,
            chat: { id: -10042, type: "supergroup", title: "Forward group" },
            from: { id: 42, is_bot: false },
            forward_origin: origin,
            text,
            ...extra,
          },
        });
      // Discovery uses the original bot, not the human who forwarded it.
      await deliver(1);
      expect(await prisma.saleTransaction.count({ where: { partyId } })).toBe(0);
      const config = await prisma.partyTelegramBotConfig.findUniqueOrThrow({ where: { partyId } });
      expect(config.discoveries).toEqual([
        expect.objectContaining({ chatId: "-10042", senderId: "77", senderUsername: "BoHpts_bot" }),
      ]);
      await prisma.partyTelegramBotConfig.update({
        where: { partyId },
        data: { chatId: "-10042", senderId: "77" },
      });
      await deliver(2, { forward_origin: undefined }); // Pasted text.
      await deliver(3, {
        forward_origin: { type: "hidden_user", date: originalDate, sender_user_name: "BoHpts_bot" },
      });
      await deliver(4, { forward_origin: { ...origin, sender_user: { id: 88, is_bot: true } } });
      await deliver(5, { forward_origin: { ...origin, sender_user: { id: 77, is_bot: false } } });
      await deliver(6, { sender_chat: { id: -10042 } });
      expect(await prisma.saleTransaction.count({ where: { partyId } })).toBe(0);
      await Promise.all([deliver(10), deliver(10), deliver(11)]);
      expect(await prisma.saleTransaction.count({ where: { partyId } })).toBe(1);
      expect(await prisma.telegramSaleImport.count({ where: { partyId, status: "IGNORED" } })).toBe(
        1,
      );
      expect(
        await prisma.telegramSaleImport.findFirst({ where: { partyId, status: "PROCESSED" } }),
      ).toMatchObject({ receivedAt: new Date(originalDate * 1000), senderId: "77" });
      // Even switching the selected destination does not post the same forward twice.
      await prisma.partyTelegramBotConfig.update({ where: { partyId }, data: { chatId: "42" } });
      const privateChat = { id: 42, type: "private", first_name: "Owner" };
      await deliver(12, { chat: privateChat });
      await deliver(13, { chat: { ...privateChat, id: 43 } });
      expect(await prisma.saleTransaction.count({ where: { partyId } })).toBe(1);
      // A genuinely newer notice with the same item and price is a new sale.
      await deliver(14, {
        chat: privateChat,
        forward_origin: { ...origin, date: originalDate + 1 },
      });
      expect(await prisma.saleTransaction.count({ where: { partyId } })).toBe(2);
      // A notice first seen as a forward cannot be counted again via the bot directly.
      await prisma.partyTelegramBotConfig.update({
        where: { partyId },
        data: { chatId: "-10042" },
      });
      await deliver(15, {
        from: origin.sender_user,
        forward_origin: undefined,
        date: originalDate,
      });
      expect(await prisma.saleTransaction.count({ where: { partyId } })).toBe(2);
      // Nor can a directly received notice be counted again by forwarding it.
      await deliver(16, {
        from: origin.sender_user,
        forward_origin: undefined,
        date: originalDate + 2,
      });
      await deliver(17, { forward_origin: { ...origin, date: originalDate + 2 } });
      expect(await prisma.saleTransaction.count({ where: { partyId } })).toBe(3);
      // Distinct original message IDs remain distinct, even at the same timestamp.
      await deliver(18, {
        from: origin.sender_user,
        forward_origin: undefined,
        date: originalDate + 3,
      });
      await deliver(19, {
        from: origin.sender_user,
        forward_origin: undefined,
        date: originalDate + 3,
      });
      expect(await prisma.saleTransaction.count({ where: { partyId } })).toBe(5);
      const cash = await prisma.ledgerEntry.aggregate({
        where: { partyId, accountType: "PARTY_CASH" },
        _sum: { debit: true },
      });
      expect(cash._sum.debit).toBe(111111110n);
    }, 120_000);

    it("connects, encrypts, rotates secrets and disconnects without leaking the bot to another party", async () => {
      process.env.DATABASE_URL = testUrl;
      const previousBase = process.env.TELEGRAM_WEBHOOK_BASE_URL;
      process.env.TELEGRAM_WEBHOOK_BASE_URL = "https://webhook.example.invalid";
      const [{ prisma }, service, { readTelegramBotToken }] = await Promise.all([
        import("@/lib/db/prisma"),
        import("./connection-service"),
        import("@/server/services/telegram-credential-service"),
      ]);
      disconnect = () => prisma.$disconnect();
      const partyId = `telegram-connect-${randomUUID()}`;
      const otherId = `telegram-other-${randomUUID()}`;
      await prisma.party.createMany({
        data: [
          { id: partyId, name: "Telegram Connect" },
          { id: otherId, name: "Other Party" },
        ],
      });
      const token = "123456789:test-only-fake-bot-token-not-a-real-token";
      const botId = Date.now();
      let registered = "";
      const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, options) => {
        const method = String(url).split("/").pop();
        if (method === "setWebhook") registered = JSON.parse(String(options?.body)).url;
        const result =
          method === "getMe"
            ? { id: botId, is_bot: true, username: "ReceivingTestBot" }
            : method === "getWebhookInfo"
              ? { url: registered, pending_update_count: 0 }
              : true;
        return new Response(JSON.stringify({ ok: true, result }), { status: 200 });
      });
      try {
        await service.connectTelegramBot(partyId, token);
        const first = await prisma.partyTelegramBotConfig.findUniqueOrThrow({ where: { partyId } });
        expect(first.encryptedToken).not.toContain(token);
        expect(await readTelegramBotToken(partyId)).toBe(token);
        expect(first.webhookEnabled).toBe(true);
        expect(await service.testTelegramConnection(partyId)).toContain("Telegram доступен");
        await expect(service.connectTelegramBot(otherId, token)).rejects.toThrow("другой группе");
        await service.connectTelegramBot(partyId);
        const rotated = await prisma.partyTelegramBotConfig.findUniqueOrThrow({
          where: { partyId },
        });
        expect(rotated.webhookId).not.toBe(first.webhookId);
        expect(rotated.webhookSecretHash).not.toBe(first.webhookSecretHash);
        await service.disconnectTelegramBot(partyId);
        expect(await prisma.partyTelegramBotConfig.findUnique({ where: { partyId } })).toBeNull();
      } finally {
        fetchMock.mockRestore();
        if (previousBase === undefined) delete process.env.TELEGRAM_WEBHOOK_BASE_URL;
        else process.env.TELEGRAM_WEBHOOK_BASE_URL = previousBase;
      }
    }, 90_000);

    it("authenticates source, posts atomic FIFO sales, deduplicates delivery and preserves history", async () => {
      process.env.DATABASE_URL = testUrl;
      vi.resetModules();
      const [{ prisma }, { POST }, { retryTelegramImport }, { secretHash }] = await Promise.all([
        import("@/lib/db/prisma"),
        import("@/app/api/telegram/webhook/[webhookId]/route"),
        import("./import-service"),
        import("./connection-service"),
      ]);
      disconnect = () => prisma.$disconnect();
      const partyId = `telegram-integration-${randomUUID()}`;
      await prisma.party.create({ data: { id: partyId, name: "Telegram Integration" } });
      const webhookId = randomBytes(24).toString("hex");
      const secret = randomBytes(32).toString("hex");
      await prisma.partyTelegramBotConfig.create({
        data: {
          partyId,
          encryptedToken: "test",
          initializationVector: "test",
          authenticationTag: "test",
          webhookId,
          webhookSecretHash: secretHash(secret),
          webhookEnabled: true,
          botId: String(Date.now()),
          chatId: "-10042",
          senderId: "77",
        },
      });
      const itemName = `Telegram Sword ${randomUUID()}`;
      const item = await prisma.item.create({
        data: { canonicalName: itemName, normalizedName: itemName.toLowerCase() },
      });
      const members = await Promise.all(
        [1, 2].map((i) =>
          prisma.partyMember.create({
            data: {
              partyId,
              nickname: `Telegram Member ${i}`,
              normalizedNickname: `telegram member ${i}`,
            },
          }),
        ),
      );
      const drops = [];
      for (const day of [1, 2]) {
        const raid = await prisma.raid.create({
          data: {
            partyId,
            name: `Telegram Raid ${day}`,
            occurredAt: new Date(`2026-11-0${day}T10:00:00Z`),
          },
        });
        await prisma.raidParticipant.createMany({
          data: members.map((member, i) => ({
            partyId,
            raidId: raid.id,
            memberId: member.id,
            nicknameSnapshot: member.nickname,
            status: "PRESENT" as const,
            distributionWeight: i === 0 ? 7 : 2,
          })),
        });
        drops.push(
          await prisma.lootDrop.create({
            data: { partyId, raidId: raid.id, itemId: item.id, quantity: day === 1 ? 2 : 8 },
          }),
        );
      }
      const text = (quantity: number, name = itemName, price = "42,222,222") =>
        `Successful sale\nItem: ${name}\nQuantity: ${quantity}\nPrice per item: ${price}`;
      let updateId = 0;
      async function deliver(
        messageId: number,
        rawText: string,
        extra: object = {},
        edited = false,
        header = secret,
      ) {
        const payload = {
          update_id: ++updateId,
          [edited ? "edited_message" : "message"]: {
            message_id: messageId,
            date: 1793960000,
            chat: { id: -10042, type: "supergroup", title: "Integration group" },
            from: { id: 77, is_bot: true, username: "BohPTSbot" },
            text: rawText,
            ...extra,
          },
        };
        return POST(
          new Request(`https://example.invalid/api/telegram/webhook/${webhookId}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Telegram-Bot-Api-Secret-Token": header,
            },
            body: JSON.stringify(payload),
          }),
          { params: Promise.resolve({ webhookId }) },
        );
      }
      expect((await deliver(1, text(4), {}, false, "wrong")).status).toBe(403);
      await deliver(2, text(4), { from: { id: 88, is_bot: true } });
      await deliver(3, text(4), { from: { id: 77, is_bot: false } });
      await deliver(4, text(4), { forward_origin: { type: "user" } });
      await deliver(5, text(4), { chat: { id: -10043, type: "supergroup" } });
      expect(await prisma.saleTransaction.count({ where: { partyId } })).toBe(0);
      const duplicate = await Promise.all([
        deliver(10, text(4)),
        deliver(10, text(4)),
        deliver(10, text(4)),
      ]);
      expect(duplicate.map((r) => r.status)).toEqual([200, 200, 200]);
      expect(await prisma.telegramSaleImport.count({ where: { partyId } })).toBe(1);
      let sales = await prisma.saleTransaction.findMany({
        where: { partyId },
        include: { shares: true },
        orderBy: { createdAt: "asc" },
      });
      expect(sales).toHaveLength(2);
      expect(sales.map((sale) => [sale.lootDropId, sale.quantitySold])).toEqual([
        [drops[0].id, 2],
        [drops[1].id, 2],
      ]);
      expect(sales.reduce((n, sale) => n + sale.totalPrice, 0n)).toBe(168888888n);
      for (const sale of sales) {
        expect(sale.shares.map((share) => share.amount)).toEqual([42222222n, 42222222n]);
        expect(sale.shares.map((share) => share.weightSnapshot).sort()).toEqual([2, 7]);
      }
      expect((await deliver(11, text(99))).status).toBe(200);
      expect(
        await prisma.telegramSaleImport.findFirst({ where: { partyId, messageId: "11" } }),
      ).toMatchObject({ status: "NEEDS_REVIEW" });
      const multi = `Sale completed\n${itemName} x1 @ 100 Adena each\nUnknown Alias x1 @ 100 Adena each\nTotal: 200 Adena`;
      await deliver(12, multi);
      expect(await prisma.saleTransaction.count({ where: { partyId } })).toBe(2);
      const pending = await prisma.telegramSaleImport.findFirstOrThrow({
        where: { partyId, messageId: "12" },
      });
      await prisma.telegramItemAlias.create({
        data: { partyId, itemId: item.id, name: "Unknown Alias", normalizedName: "unknown alias" },
      });
      expect(await retryTelegramImport(partyId, pending.id)).toMatchObject({ status: "PROCESSED" });
      await retryTelegramImport(partyId, pending.id).catch(() => undefined);
      expect(await prisma.saleTransaction.count({ where: { partyId } })).toBe(4);
      await deliver(10, text(9), {}, true);
      expect(await prisma.saleTransaction.count({ where: { partyId } })).toBe(4);
      expect(
        await prisma.telegramSaleImport.findFirst({ where: { partyId, messageId: "10" } }),
      ).toMatchObject({ status: "PROCESSED", reason: expect.stringContaining("изменено") });
      // Four units remain. Concurrent distinct messages cannot both spend them.
      const contested = await Promise.all([
        deliver(20, text(4, itemName, "100")),
        deliver(21, text(4, itemName, "100")),
      ]);
      expect(contested.map((r) => r.status)).toEqual([200, 200]);
      const contestedRecords = await prisma.telegramSaleImport.findMany({
        where: { partyId, messageId: { in: ["20", "21"] } },
      });
      expect(contestedRecords.map((r) => r.status).sort()).toEqual(["NEEDS_REVIEW", "PROCESSED"]);
      sales = await prisma.saleTransaction.findMany({
        where: { partyId },
        include: { shares: true },
        orderBy: { createdAt: "asc" },
      });
      expect(sales.reduce((n, sale) => n + sale.quantitySold, 0)).toBe(10);
      expect(sales.reduce((n, sale) => n + sale.totalPrice, 0n)).toBe(168889488n);
      const cash = await prisma.ledgerEntry.aggregate({
        where: { partyId, accountType: "PARTY_CASH" },
        _sum: { debit: true },
      });
      expect(cash._sum.debit).toBe(168889488n);
      // The second allocation fails inside the sale writer, after the first one wrote.
      const brokenName = `Broken Telegram ${randomUUID()}`;
      const brokenItem = await prisma.item.create({
        data: { canonicalName: brokenName, normalizedName: brokenName.toLowerCase() },
      });
      for (const day of [3, 4]) {
        const raid = await prisma.raid.create({
          data: {
            partyId,
            name: `Rollback Raid ${day}`,
            occurredAt: new Date(`2026-11-0${day}T10:00:00Z`),
          },
        });
        if (day === 3)
          await prisma.raidParticipant.create({
            data: {
              partyId,
              raidId: raid.id,
              memberId: members[0].id,
              nicknameSnapshot: members[0].nickname,
              status: "PRESENT",
              distributionWeight: 7,
            },
          });
        await prisma.lootDrop.create({
          data: { partyId, raidId: raid.id, itemId: brokenItem.id, quantity: 1 },
        });
      }
      const countBeforeFailure = sales.length;
      await deliver(22, text(2, brokenName, "100"));
      expect(await prisma.saleTransaction.count({ where: { partyId } })).toBe(countBeforeFailure);
      expect(
        await prisma.telegramSaleImport.findFirst({ where: { partyId, messageId: "22" } }),
      ).toMatchObject({ status: "NEEDS_REVIEW" });
      // Disconnect invalidates the route; no new sales can be imported.
      await prisma.partyTelegramBotConfig.update({
        where: { partyId },
        data: { webhookEnabled: false },
      });
      expect((await deliver(30, text(1))).status).toBe(503);
    }, 120_000);
  },
);
