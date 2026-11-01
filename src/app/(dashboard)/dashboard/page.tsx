import { Suspense } from "react";
import { io } from "next/cache";
import { ArrowUpRight, CircleUserRound, UsersRound, WalletCards } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getPartyMemberCounts } from "@/server/repositories/party-repository";
import { ensureLocalWorkspace } from "@/server/bootstrap/local-workspace";

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardOverviewFallback />}>
      <DashboardOverview />
    </Suspense>
  );
}

async function DashboardOverview() {
  await io();
  const workspace = await ensureLocalWorkspace();
  const counts = await getPartyMemberCounts(workspace.partyId);

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <Badge variant="outline" className="mb-4 border-primary/30 text-primary">
            ОСНОВА ПРОЕКТА
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight">Добро пожаловать</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Управляйте составом группы и настройками локального пространства.
          </p>
        </div>
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80"
        >
          Настройки группы <ArrowUpRight aria-hidden="true" size={16} />
        </Link>
      </section>

      <section aria-label="Сводка" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div className="space-y-1">
              <CardDescription>Рабочее пространство</CardDescription>
              <CardTitle className="text-lg">{workspace.partyName}</CardTitle>
            </div>
            <span className="rounded-lg bg-primary/10 p-2 text-primary">
              <WalletCards aria-hidden="true" size={19} />
            </span>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Локальная группа · SQLite
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div className="space-y-1">
              <CardDescription>Активный состав</CardDescription>
              <CardTitle className="text-3xl">{counts.activeMembers}</CardTitle>
            </div>
            <span className="rounded-lg bg-emerald-400/10 p-2 text-emerald-300">
              <UsersRound aria-hidden="true" size={19} />
            </span>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {counts.totalMembers} {counts.totalMembers === 1 ? "участник всего" : "участников всего"}
          </CardContent>
        </Card>

        <Card className="sm:col-span-2 xl:col-span-1">
          <CardHeader className="flex-row items-start justify-between">
            <div className="space-y-1">
              <CardDescription>Профиль доступа</CardDescription>
              <CardTitle className="text-lg">Владелец</CardTitle>
            </div>
            <span className="rounded-lg bg-rose-400/10 p-2 text-rose-300">
              <CircleUserRound aria-hidden="true" size={19} />
            </span>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Локальная инициализация · без внешней авторизации
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Начните с состава группы</CardTitle>
          <CardDescription>
            Добавляйте игровые персонажи и отключайте участников, не удаляя историю.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/members"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            Перейти к участникам <ArrowUpRight aria-hidden="true" size={16} />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function DashboardOverviewFallback() {
  return <div className="h-72 animate-pulse rounded-2xl bg-muted/50" />;
}
