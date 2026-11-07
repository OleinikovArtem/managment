import { Suspense } from "react";
import { io } from "next/cache";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { requirePartyPageAccess } from "@/server/auth/party-access";
import { getPartyBalances, getSales } from "@/server/services/sale-service";
import { getPayments } from "@/server/services/payment-service";
import { listRaids } from "@/server/services/raid-service";
import { getPartyMemberCounts } from "@/server/repositories/party-repository";
import { DashboardAnalytics, type DashboardSale } from "@/features/dashboard/dashboard-analytics";

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="h-[32rem] animate-pulse rounded-2xl bg-muted/50" />}>
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  await io();
  const workspace = await requirePartyPageAccess();
  const [sales, payments, balances, raids, memberCounts] = await Promise.all([
    getSales(workspace.partyId),
    getPayments(workspace.partyId),
    getPartyBalances(workspace.partyId),
    listRaids(workspace.partyId),
    getPartyMemberCounts(workspace.partyId),
  ]);
  const dashboardSales: DashboardSale[] = sales.map((sale) => ({
    id: sale.id,
    receivedAt: sale.receivedAt.toISOString(),
    totalPrice: sale.totalPrice.toString(),
    quantitySold: sale.quantitySold,
    raidName: sale.raid.name,
    instanceName: sale.raid.instanceName,
    itemName: sale.lootDrop.item.displayName || sale.lootDrop.item.canonicalName,
    category: sale.lootDrop.item.category || "Без категории",
    shares: sale.shares.map((share) => ({
      nickname: share.nicknameSnapshot,
      amount: share.amount.toString(),
    })),
  }));
  return (
    <div className="space-y-5">
      <header className="page-header flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Обзор</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Состояние группы, продажи и ближайшие действия.
          </p>
        </div>
        {workspace.canManage && (
          <Link
            href="/raids/new"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80"
          >
            Новый рейд <ArrowUpRight aria-hidden="true" size={15} />
          </Link>
        )}
      </header>
      <DashboardAnalytics
        recentRaids={raids.slice(0, 5).map((raid) => ({
          id: raid.id,
          name: raid.name,
          occurredAt: raid.occurredAt.toISOString(),
          present: raid.participants.filter((p) => p.status === "PRESENT").length,
          drops: raid.lootDrops.length,
        }))}
        sales={dashboardSales}
        totalRaids={raids.length}
        totalDrops={raids.reduce((sum, raid) => sum + raid.lootDrops.length, 0)}
        totalPaid={payments.reduce((sum, payment) => sum + payment.amount, 0n).toString()}
        partyCash={balances.partyCash.toString()}
        outstanding={balances.memberBalances
          .reduce((sum, member) => sum + member.payable, 0n)
          .toString()}
        activeMembers={memberCounts.activeMembers}
        totalMembers={memberCounts.totalMembers}
      />
    </div>
  );
}
