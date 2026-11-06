import { prisma } from "@/lib/db/prisma";
import { verifyWebhookSecret } from "@/server/telegram/connection-service";
import { receiveTelegramUpdate, telegramUpdateSchema } from "@/server/telegram/import-service";

export const maxDuration = 120;

export async function POST(request: Request, { params }: { params: Promise<{ webhookId: string }> }) {
  const { webhookId } = await params;
  if (!/^[a-f0-9]{48}$/.test(webhookId)) return new Response(null, { status: 404 });
  try {
    const config = await prisma.partyTelegramBotConfig.findUnique({ where: { webhookId }, select: { webhookSecretHash: true, webhookEnabled: true } });
    if (!config || !verifyWebhookSecret(config.webhookSecretHash, request.headers.get("X-Telegram-Bot-Api-Secret-Token"))) return new Response(null, { status: 403 });
    if (!config.webhookEnabled) return new Response(null, { status: 503 });
    if (Number(request.headers.get("content-length")) > 65_536) return new Response(null, { status: 413 });
    const text = await request.text();
    if (Buffer.byteLength(text) > 65_536) return new Response(null, { status: 413 });
    let payload: unknown;
    try { payload = JSON.parse(text); } catch { return new Response(null, { status: 400 }); }
    const parsed = telegramUpdateSchema.safeParse(payload);
    if (!parsed.success) return new Response(null, { status: 400 });
    await receiveTelegramUpdate(webhookId, parsed.data);
    return Response.json({ ok: true });
  } catch {
    // Do not log the payload, URL, header or credential-bearing exceptions.
    console.error("Telegram import unavailable; delivery should be retried.");
    return new Response(null, { status: 503, headers: { "Retry-After": "5" } });
  }
}
