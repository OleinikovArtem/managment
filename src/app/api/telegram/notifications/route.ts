import {
  AuthenticationRequiredError,
  PartyAccessRequiredError,
  requirePartyActionAccess,
} from "@/server/auth/party-access";
import { unreadTelegramImports } from "@/server/telegram/query-service";
import { unstable_rethrow } from "next/navigation";

export async function GET() {
  try {
    const access = await requirePartyActionAccess("MEMBER");
    const items = await unreadTelegramImports(access.partyId, access.userId);
    return Response.json(
      { partyId: access.partyId, items },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof AuthenticationRequiredError) return new Response(null, { status: 401 });
    if (error instanceof PartyAccessRequiredError) return new Response(null, { status: 403 });
    console.error("Telegram notifications unavailable.");
    return new Response(null, { status: 503 });
  }
}
