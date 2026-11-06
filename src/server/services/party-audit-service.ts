import "server-only";

import type { PartyAccess } from "@/server/auth/party-access";
import { prisma } from "@/lib/db/prisma";

export async function recordPartyAuditEvent(
  access: PartyAccess,
  event: { action: string; entityType: string; entityId?: string; summary: string },
) {
  try {
    await prisma.partyAuditEvent.create({
      data: {
        partyId: access.partyId,
        actorUserId: access.userId,
        actorNameSnapshot: access.displayName,
        actorUsernameSnapshot: access.username,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        summary: event.summary.slice(0, 400),
      },
    });
  } catch (error) {
    // The domain mutation may already be committed. Never report it as failed
    // just because the separate activity-log insert could not be persisted.
    console.error("Failed to record party activity event", {
      partyId: access.partyId,
      action: event.action,
      entityType: event.entityType,
      error,
    });
  }
}

export async function listPartyAuditEvents(partyId: string) {
  return prisma.partyAuditEvent.findMany({
    where: { partyId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
    select: {
      id: true,
      actorNameSnapshot: true,
      actorUsernameSnapshot: true,
      action: true,
      entityType: true,
      entityId: true,
      summary: true,
      createdAt: true,
    },
  });
}
