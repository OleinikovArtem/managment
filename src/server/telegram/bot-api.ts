import "server-only";

export class TelegramConnectionError extends Error {}

export async function telegramApi<T>(token: string, method: "getMe" | "setWebhook" | "deleteWebhook" | "getWebhookInfo", body: Record<string, unknown> = {}): Promise<T> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      signal: AbortSignal.timeout(12_000), cache: "no-store",
    });
    const result: { ok?: boolean; result?: T } = await response.json();
    if (!response.ok || !result.ok || result.result === undefined) throw new Error();
    return result.result;
  } catch {
    // Never include a fetch exception, URL or Telegram response (the URL holds the token).
    throw new TelegramConnectionError("Telegram не ответил или отклонил запрос. Проверьте токен и права бота, затем повторите.");
  }
}
