ALTER TABLE "PartyCompositionMember"
ADD COLUMN "classOverride" TEXT;

ALTER TABLE "PartyCompositionMember"
ADD CONSTRAINT "PartyCompositionMember_profile_class_override_check"
CHECK ("profileId" IS NULL OR "classOverride" IS NULL);
