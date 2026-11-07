import { Suspense } from "react";
import { io } from "next/cache";
import { LootList } from "@/features/loot/loot-list";
import { LootListSkeleton } from "@/components/ui/page-skeleton";
import { requirePartyPageAccess } from "@/server/auth/party-access";
import { listPartyLoot } from "@/server/repositories/loot-repository";

export default function LootPage() {
  return (
    <div>
      <header className="page-header">
        <h1>Лут</h1>
        <p className="mt-2">
          Вся добыча группы, остатки и полученная оплата. Новые поступления сверху.
        </p>
      </header>
      <Suspense fallback={<LootListSkeleton />}>
        <LootContent />
      </Suspense>
    </div>
  );
}

async function LootContent() {
  await io();
  const access = await requirePartyPageAccess();
  const rows = await listPartyLoot(access.partyId);
  return <LootList rows={rows} canManage={access.canManage} />;
}
