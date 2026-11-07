-- Additional guards for shared/private catalog boundaries and stage history.
CREATE INDEX IF NOT EXISTS "Party_selectedStageId_idx" ON "Party" ("selectedStageId");
CREATE UNIQUE INDEX IF NOT EXISTS "Item_global_normalizedName_key" ON "Item" ("normalizedName") WHERE "partyId" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Instance_global_normalizedName_key" ON "Instance" ("normalizedName") WHERE "partyId" IS NULL;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='Instance_source_owner_check') THEN
 ALTER TABLE "Instance" ADD CONSTRAINT "Instance_source_owner_check" CHECK ((source='CUSTOM') = ("partyId" IS NOT NULL)); END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='ServerStage_valid_check') THEN
 ALTER TABLE "ServerStage" ADD CONSTRAINT "ServerStage_valid_check" CHECK (sequence>0 AND revision>0 AND (NOT "isSelectable" OR "publishedAt" IS NOT NULL)); END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='ServerStageConfig_singleton_check') THEN
 ALTER TABLE "ServerStageConfig" ADD CONSTRAINT "ServerStageConfig_singleton_check" CHECK (id='GLOBAL'); END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='PartyCompositionMember_profile_class_override_check') THEN
 ALTER TABLE "PartyCompositionMember" ADD CONSTRAINT "PartyCompositionMember_profile_class_override_check" CHECK ("profileId" IS NULL OR "classOverride" IS NULL); END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='Raid_stage_snapshot_check') THEN
 ALTER TABLE "Raid" ADD CONSTRAINT "Raid_stage_snapshot_check" CHECK (("stageId" IS NULL AND "stageRevisionSnapshot" IS NULL AND "stageNameSnapshot" IS NULL AND "stageCodeSnapshot" IS NULL) OR ("stageId" IS NOT NULL AND "stageRevisionSnapshot">0 AND "stageNameSnapshot" IS NOT NULL AND "stageCodeSnapshot" IS NOT NULL)); END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='InstanceStageLootRecommendation_order_check') THEN
 ALTER TABLE "InstanceStageLootRecommendation" ADD CONSTRAINT "InstanceStageLootRecommendation_order_check" CHECK ("sortOrder">=0); END IF;
END $$;

CREATE OR REPLACE FUNCTION pbm_catalog_owner_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."partyId" IS DISTINCT FROM OLD."partyId" THEN RAISE EXCEPTION 'Catalog owner is immutable'; END IF;
 IF TG_TABLE_NAME='Instance' AND (to_jsonb(NEW)->>'code' IS DISTINCT FROM to_jsonb(OLD)->>'code' OR to_jsonb(NEW)->>'source' IS DISTINCT FROM to_jsonb(OLD)->>'source') THEN RAISE EXCEPTION 'Instance code/source is immutable'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS catalog_owner_guard ON "Item";
CREATE TRIGGER catalog_owner_guard BEFORE UPDATE ON "Item" FOR EACH ROW EXECUTE FUNCTION pbm_catalog_owner_immutable();
DROP TRIGGER IF EXISTS catalog_owner_guard ON "Instance";
CREATE TRIGGER catalog_owner_guard BEFORE UPDATE ON "Instance" FOR EACH ROW EXECUTE FUNCTION pbm_catalog_owner_immutable();

CREATE OR REPLACE FUNCTION pbm_catalog_reference_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_id text; instance_owner text;
BEGIN
 IF TG_TABLE_NAME='Raid' THEN
  IF NEW."stageId" IS NOT NULL AND (NEW."stageRevisionSnapshot" IS NULL OR NEW."stageNameSnapshot" IS NULL OR NEW."stageCodeSnapshot" IS NULL) THEN RAISE EXCEPTION 'Raid stage snapshot is incomplete'; END IF;
  IF (NEW."creationKey" IS NULL) <> (NEW."creationPayloadHash" IS NULL) THEN RAISE EXCEPTION 'Raid creation identity is incomplete'; END IF;
  IF TG_OP='UPDATE' AND (NEW."stageId",NEW."stageCodeSnapshot",NEW."stageNameSnapshot",NEW."stageRevisionSnapshot") IS DISTINCT FROM (OLD."stageId",OLD."stageCodeSnapshot",OLD."stageNameSnapshot",OLD."stageRevisionSnapshot") THEN RAISE EXCEPTION 'Raid stage history is immutable'; END IF;
  IF NEW."instanceId" IS NOT NULL THEN
   SELECT "partyId" INTO instance_owner FROM "Instance" WHERE id=NEW."instanceId";
   IF instance_owner IS NOT NULL AND instance_owner<>NEW."partyId" THEN RAISE EXCEPTION 'Instance belongs to another party'; END IF;
  END IF;
 ELSE
  SELECT "partyId" INTO owner_id FROM "Item" WHERE id=NEW."itemId";
  IF TG_TABLE_NAME='InstanceStageLootRecommendation' THEN
   SELECT "partyId" INTO instance_owner FROM "Instance" WHERE id=NEW."instanceId";
   IF owner_id IS NOT NULL OR instance_owner IS NOT NULL THEN RAISE EXCEPTION 'Global recommendations require global catalog entries'; END IF;
  ELSIF owner_id IS NOT NULL AND owner_id<>NEW."partyId" THEN RAISE EXCEPTION 'Item belongs to another party'; END IF;
 END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['Raid','LootDrop','TelegramItemAlias','PartyInstanceLootPresetItem','PartyQuickLootItem','InstanceStageLootRecommendation'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS catalog_reference_guard ON %I',t);
  EXECUTE format('CREATE TRIGGER catalog_reference_guard BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION pbm_catalog_reference_guard()',t);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION pbm_stage_reference_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target text; BEGIN
 IF TG_TABLE_NAME='Party' THEN
  IF TG_OP='UPDATE' AND NEW."selectedStageId" IS NOT DISTINCT FROM OLD."selectedStageId" THEN RETURN NEW; END IF;
  target:=NEW."selectedStageId";
 ELSE target:=NEW."explicitCurrentStageId";
 END IF;
 IF target IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "ServerStage" WHERE id=target AND "publishedAt" IS NOT NULL AND "isSelectable") THEN RAISE EXCEPTION 'Stage is unavailable'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS stage_reference_guard ON "Party";
CREATE TRIGGER stage_reference_guard BEFORE INSERT OR UPDATE ON "Party" FOR EACH ROW EXECUTE FUNCTION pbm_stage_reference_guard();
DROP TRIGGER IF EXISTS stage_reference_guard ON "ServerStageConfig";
CREATE TRIGGER stage_reference_guard BEFORE INSERT OR UPDATE ON "ServerStageConfig" FOR EACH ROW EXECUTE FUNCTION pbm_stage_reference_guard();

CREATE OR REPLACE FUNCTION pbm_stage_publication_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD."publishedAt" IS NOT NULL AND (NEW."publishedAt" IS NULL OR NEW.code<>OLD.code OR NEW.sequence<>OLD.sequence) THEN RAISE EXCEPTION 'Published stage identity is immutable'; END IF;
 IF NOT NEW."isSelectable" AND EXISTS(SELECT 1 FROM "ServerStageConfig" WHERE "explicitCurrentStageId"=OLD.id) THEN RAISE EXCEPTION 'Switch explicit current stage before disabling it'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS stage_publication_guard ON "ServerStage";
CREATE TRIGGER stage_publication_guard BEFORE UPDATE ON "ServerStage" FOR EACH ROW EXECUTE FUNCTION pbm_stage_publication_guard();
INSERT INTO "ServerStageConfig" (id,"updatedAt") VALUES ('GLOBAL',CURRENT_TIMESTAMP) ON CONFLICT(id) DO NOTHING;
