import { ensureLocalWorkspace } from "@/server/bootstrap/local-workspace";
import { exportFinancialHistoryCsv } from "@/server/services/sale-service";

export async function GET() {
  const workspace = await ensureLocalWorkspace();
  const csv = await exportFinancialHistoryCsv(workspace.partyId);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="financial-history.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
