import {
  AuthenticationRequiredError,
  PartyAccessRequiredError,
  requirePartyActionAccess,
} from "@/server/auth/party-access";
import { exportFinancialHistoryCsv } from "@/server/services/sale-service";

export async function GET() {
  let access;
  try {
    access = await requirePartyActionAccess("MEMBER");
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return new Response(null, { status: 401 });
    if (error instanceof PartyAccessRequiredError) return new Response(null, { status: 403 });
    throw error;
  }
  const csv = await exportFinancialHistoryCsv(access.partyId);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="financial-history.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
