ALTER TABLE "PartyMemberProfile" ADD COLUMN "subclassSlot" INTEGER;
ALTER TABLE "PartyMemberProfile" ADD CONSTRAINT "PartyMemberProfile_subclassSlot_range"
  CHECK ("subclassSlot" BETWEEN 1 AND 4);

-- Existing profile identities and raid snapshots stay intact. Any profiles
-- beyond the four supported slots remain available for explicit legacy cleanup.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "partyId", "memberId" ORDER BY "createdAt", id) AS slot
  FROM "PartyMemberProfile" WHERE "isActive" = true
)
UPDATE "PartyMemberProfile" p SET "subclassSlot" = ranked.slot::integer
FROM ranked WHERE p.id = ranked.id AND ranked.slot <= 4;

CREATE UNIQUE INDEX "PartyMemberProfile_partyId_memberId_subclassSlot_key"
  ON "PartyMemberProfile" ("partyId", "memberId", "subclassSlot");
