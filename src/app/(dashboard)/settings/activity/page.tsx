import { Suspense } from "react";
import { io } from "next/cache";
import { requirePartyPageAccess } from "@/server/auth/party-access";
import { listPartyAuditEvents } from "@/server/services/party-audit-service";
import { RowsOnlySkeleton } from "@/components/ui/page-skeleton";

export default function PartyActivityPage() {
  return (
    <section className="max-w-4xl space-y-6">
      <header className="page-header">
        <h1>История действий</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Кто и когда менял данные этой группы. Здесь хранятся последние 100 действий.
        </p>
      </header>
      <Suspense fallback={<RowsOnlySkeleton label="Загружается история действий" />}>
        <PartyActivityContent />
      </Suspense>
    </section>
  );
}

async function PartyActivityContent() {
  await io();
  const access = await requirePartyPageAccess();
  const events = await listPartyAuditEvents(access.partyId);
  return (
    <>
      {events.length ? (
        <ol className="divide-y divide-border border-y border-border">
          {events.map((event) => (
            <li key={event.id} className="py-3">
              <p className="text-sm font-medium">{event.summary}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {event.actorNameSnapshot}
                {event.actorUsernameSnapshot ? ` · @${event.actorUsernameSnapshot}` : ""} ·{" "}
                {event.createdAt.toLocaleString("ru-RU")}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">Действий пока нет.</p>
      )}
    </>
  );
}
