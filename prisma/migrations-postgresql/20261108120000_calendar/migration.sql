CREATE TABLE "CalendarRule" (
 "id" TEXT NOT NULL PRIMARY KEY, "partyId" TEXT NOT NULL REFERENCES "Party"("id") ON DELETE RESTRICT,
 "instanceId" TEXT NOT NULL REFERENCES "Instance"("id") ON DELETE RESTRICT,
 "revision" INTEGER NOT NULL DEFAULT 1 CHECK ("revision" > 0), "lockoutKey" TEXT NOT NULL,
 "timezone" TEXT NOT NULL, "type" TEXT NOT NULL CHECK ("type" IN ('daily','weekly')),
 "localTime" TEXT NOT NULL CHECK ("localTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
 "isoWeekdays" INTEGER[] NOT NULL, "effectiveFrom" TIMESTAMP(3) NOT NULL, "demo" BOOLEAN NOT NULL DEFAULT true,
 CONSTRAINT "CalendarRule_partyId_id_key" UNIQUE ("partyId","id"),
 CONSTRAINT "CalendarRule_partyId_instanceId_revision_key" UNIQUE ("partyId","instanceId","revision")
);
CREATE TABLE "CalendarClosure" (
 "id" TEXT NOT NULL PRIMARY KEY, "partyId" TEXT NOT NULL REFERENCES "Party"("id") ON DELETE RESTRICT,
 "memberId" TEXT NOT NULL, "ruleId" TEXT NOT NULL, "requestKey" TEXT NOT NULL, "payloadHash" TEXT NOT NULL,
 "nicknameSnapshot" TEXT NOT NULL, "occurredAt" TIMESTAMP(3) NOT NULL, "periodStart" TIMESTAMP(3) NOT NULL,
 "periodEnd" TIMESTAMP(3) NOT NULL, "actorId" TEXT NOT NULL, "actorName" TEXT NOT NULL,
 "comment" TEXT NOT NULL DEFAULT '', "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version">0),
 "cancelledAt" TIMESTAMP(3), "cancelledBy" TEXT, "cancelReason" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("partyId","memberId") REFERENCES "PartyMember"("partyId","id") ON DELETE RESTRICT,
 FOREIGN KEY ("partyId","ruleId") REFERENCES "CalendarRule"("partyId","id") ON DELETE RESTRICT,
 CHECK ("periodStart" <= "occurredAt" AND "occurredAt" < "periodEnd"),
 CHECK (("cancelledAt" IS NULL AND "cancelledBy" IS NULL AND "cancelReason" IS NULL) OR ("cancelledAt" IS NOT NULL AND "cancelledBy" IS NOT NULL AND length(trim("cancelReason")) > 0))
);
CREATE UNIQUE INDEX "CalendarClosure_partyId_requestKey_memberId_key" ON "CalendarClosure"("partyId","requestKey","memberId");
CREATE INDEX "CalendarClosure_partyId_occurredAt_idx" ON "CalendarClosure"("partyId","occurredAt");
