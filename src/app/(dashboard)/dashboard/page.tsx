import { Suspense } from "react";
import { io } from "next/cache";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ensureLocalWorkspace } from "@/server/bootstrap/local-workspace";
import { getPartyBalances, getSales } from "@/server/services/sale-service";
import { getPayments } from "@/server/services/payment-service";
import { listRaids } from "@/server/services/raid-service";
import { getPartyMemberCounts } from "@/server/repositories/party-repository";
import { DashboardAnalytics, type DashboardSale } from "@/features/dashboard/dashboard-analytics";

export default function DashboardPage() {
  return <Suspense fallback={<div className="h-[32rem] animate-pulse rounded-2xl bg-muted/50" />}><DashboardContent /></Suspense>;
}

async function DashboardContent() {
  await io();
  const workspace = await ensureLocalWorkspace();
  const [sales, payments, balances, raids, memberCounts] = await Promise.all([
    getSales(workspace.partyId), getPayments(workspace.partyId), getPartyBalances(workspace.partyId), listRaids(workspace.partyId), getPartyMemberCounts(workspace.partyId),
  ]);
  const dashboardSales: DashboardSale[] = sales.map((sale) => ({
    id: sale.id, receivedAt: sale.receivedAt.toISOString(), totalPrice: sale.totalPrice.toString(), quantitySold: sale.quantitySold,
    raidName: sale.raid.name, instanceName: sale.raid.instanceName, itemName: sale.lootDrop.item.displayName || sale.lootDrop.item.canonicalName,
    category: sale.lootDrop.item.category || "Без категории", shares: sale.shares.map((share) => ({ nickname: share.nicknameSnapshot, amount: share.amount.toString() })),
  }));
  return <div className="space-y-6"><header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div><p className="text-sm font-medium text-primary">{workspace.partyName}</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Дашборд</h1><p className="mt-2 text-sm text-muted-foreground">Доходы от дропа, распределение Adena и активность группы в одном месте.</p></div><Link href="/raids/new" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80">Добавить рейд <ArrowUpRight aria-hidden="true" size={16} /></Link></header><DashboardAnalytics sales={dashboardSales} totalRaids={raids.length} totalDrops={raids.reduce((sum, raid) => sum + raid.lootDrops.length, 0)} totalPaid={payments.reduce((sum, payment) => sum + payment.amount, 0n).toString()} partyCash={balances.partyCash.toString()} outstanding={balances.memberBalances.reduce((sum, member) => sum + member.payable, 0n).toString()} activeMembers={memberCounts.activeMembers} totalMembers={memberCounts.totalMembers} /></div>;
}
