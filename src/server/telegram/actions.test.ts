import { beforeEach, describe, expect, it, vi } from "vitest";
const { access } = vi.hoisted(() => ({ access: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/auth/party-access", () => ({ requirePartyActionAccess: access }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));
vi.mock("@/server/telegram/connection-service", () => ({ connectTelegramBot: vi.fn(), disconnectTelegramBot: vi.fn(), testTelegramConnection: vi.fn() }));
vi.mock("@/server/telegram/import-service", () => ({ retryTelegramImport: vi.fn() }));
vi.mock("@/server/services/party-audit-service", () => ({ recordPartyAuditEvent: vi.fn() }));
import { reconnectTelegramAction, removeTelegramTokenAction, saveTelegramSourceAction, saveTelegramTokenAction, testTelegramAction } from "@/app/(dashboard)/settings/telegram-actions";
import { dismissTelegramImportAction, readTelegramImportsAction, retryTelegramImportAction, saveTelegramAliasAction, removeTelegramAliasAction } from "@/app/(dashboard)/telegram/actions";

describe("Telegram permissions", () => {
  beforeEach(() => { access.mockReset().mockRejectedValue(new Error("Access denied")); });
  it.each([
    ["save token", () => saveTelegramTokenAction("token")],
    ["reconnect", reconnectTelegramAction], ["disconnect", removeTelegramTokenAction],
    ["test", testTelegramAction], ["source", () => saveTelegramSourceAction("-10042", "77")],
  ] as const)("requires OWNER before %s", async (_name, action) => {
    await expect(action()).rejects.toThrow("Access denied");
    expect(access).toHaveBeenCalledExactlyOnceWith("OWNER");
  });
  it.each([
    ["retry", () => retryTelegramImportAction("import", "text")],
    ["dismiss", () => dismissTelegramImportAction("import")],
    ["alias", () => saveTelegramAliasAction("Sword", "item")],
    ["delete alias", () => removeTelegramAliasAction("alias")],
  ] as const)("requires ADMIN before %s", async (_name, action) => {
    await expect(action()).rejects.toThrow("Access denied");
    expect(access).toHaveBeenCalledExactlyOnceWith("ADMIN");
  });
  it("requires party membership to mark notifications read", async () => {
    await expect(readTelegramImportsAction()).rejects.toThrow("Access denied");
    expect(access).toHaveBeenCalledExactlyOnceWith("MEMBER");
  });
});
