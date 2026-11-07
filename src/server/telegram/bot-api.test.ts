import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));
import { telegramApi } from "./bot-api";
import { secretHash, verifyWebhookSecret } from "./connection-service";
afterEach(() => vi.unstubAllGlobals());

describe("Telegram transport security", () => {
  it("compares webhook secret hashes and rejects missing or long headers", () => {
    const hash = secretHash("correct_secret");
    expect(verifyWebhookSecret(hash, "correct_secret")).toBe(true);
    expect(verifyWebhookSecret(hash, "wrong")).toBe(false);
    expect(verifyWebhookSecret(hash, null)).toBe(false);
    expect(verifyWebhookSecret(null, "correct_secret")).toBe(false);
    expect(verifyWebhookSecret(hash, "a".repeat(257))).toBe(false);
  });
  it("does not expose tokens, remote response text or credential-bearing fetch errors", async () => {
    const token = "123456:never-print-this-token";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error(`https://api.telegram.org/bot${token}/getMe`)),
    );
    await expect(telegramApi(token, "getMe")).rejects.not.toThrow(token);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: false, json: async () => ({ ok: false, description: token }) }),
    );
    await expect(telegramApi(token, "getMe")).rejects.not.toThrow(token);
  });
});
