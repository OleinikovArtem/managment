CREATE TABLE "PartyAuditEvent" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorNameSnapshot" TEXT NOT NULL,
    "actorUsernameSnapshot" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartyAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PartyAuditEvent_partyId_createdAt_idx" ON "PartyAuditEvent"("partyId", "createdAt");
CREATE INDEX "PartyAuditEvent_actorUserId_createdAt_idx" ON "PartyAuditEvent"("actorUserId", "createdAt");

ALTER TABLE "PartyAuditEvent" ADD CONSTRAINT "PartyAuditEvent_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartyAuditEvent" ADD CONSTRAINT "PartyAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
