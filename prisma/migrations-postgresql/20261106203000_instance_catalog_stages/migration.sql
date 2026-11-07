BEGIN;
-- CreateEnum
CREATE TYPE "InstanceSource" AS ENUM ('H5', 'SERVER_VARIANT', 'CUSTOM');

-- AlterTable
ALTER TABLE "Party" ADD COLUMN     "selectedStageId" TEXT,
ADD COLUMN     "stageSelectionRevision" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "partyId" TEXT;

-- Install the replacement before removing the old unique constraint.
CREATE UNIQUE INDEX "Item_global_normalizedName_key" ON "Item" ("normalizedName") WHERE "partyId" IS NULL;
DROP INDEX "Item_normalizedName_key";

-- AlterTable
ALTER TABLE "Raid" ADD COLUMN     "creationKey" TEXT,
ADD COLUMN     "creationPayloadHash" TEXT,
ADD COLUMN     "instanceId" TEXT,
ADD COLUMN     "stageCodeSnapshot" TEXT,
ADD COLUMN     "stageId" TEXT,
ADD COLUMN     "stageNameSnapshot" TEXT,
ADD COLUMN     "stageRevisionSnapshot" INTEGER;

-- CreateTable
CREATE TABLE "Instance" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "aliases" TEXT[],
    "category" TEXT NOT NULL,
    "source" "InstanceSource" NOT NULL,
    "partyId" TEXT,
    "imagePath" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Instance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServerStage" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "isSelectable" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServerStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServerStageConfig" (
    "id" TEXT NOT NULL,
    "explicitCurrentStageId" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServerStageConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstanceStageLootRecommendation" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "sourceMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstanceStageLootRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyInstanceLootPreset" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "sourceLabel" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyInstanceLootPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyInstanceLootPresetItem" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "presetId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "PartyInstanceLootPresetItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyQuickLootItem" (
    "partyId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyQuickLootItem_pkey" PRIMARY KEY ("partyId","itemId")
);

-- CreateTable
CREATE TABLE "ServerStageAuditEvent" (
    "id" TEXT NOT NULL,
    "stageId" TEXT,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "sourceLabel" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "beforeState" JSONB,
    "afterState" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServerStageAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Instance_code_key" ON "Instance"("code");

-- CreateIndex
CREATE INDEX "Instance_partyId_isActive_idx" ON "Instance"("partyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Instance_partyId_id_key" ON "Instance"("partyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Instance_partyId_normalizedName_key" ON "Instance"("partyId", "normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "ServerStage_code_key" ON "ServerStage"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ServerStage_sequence_key" ON "ServerStage"("sequence");

-- CreateIndex
CREATE INDEX "InstanceStageLootRecommendation_stageId_instanceId_sortOrde_idx" ON "InstanceStageLootRecommendation"("stageId", "instanceId", "sortOrder");

-- CreateIndex
CREATE INDEX "InstanceStageLootRecommendation_itemId_idx" ON "InstanceStageLootRecommendation"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "InstanceStageLootRecommendation_instanceId_stageId_itemId_key" ON "InstanceStageLootRecommendation"("instanceId", "stageId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "PartyInstanceLootPreset_partyId_instanceId_key" ON "PartyInstanceLootPreset"("partyId", "instanceId");

-- CreateIndex
CREATE UNIQUE INDEX "PartyInstanceLootPreset_partyId_id_key" ON "PartyInstanceLootPreset"("partyId", "id");

-- CreateIndex
CREATE INDEX "PartyInstanceLootPresetItem_partyId_presetId_sortOrder_idx" ON "PartyInstanceLootPresetItem"("partyId", "presetId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PartyInstanceLootPresetItem_presetId_itemId_key" ON "PartyInstanceLootPresetItem"("presetId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ServerStageAuditEvent_idempotencyKey_key" ON "ServerStageAuditEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ServerStageAuditEvent_stageId_createdAt_idx" ON "ServerStageAuditEvent"("stageId", "createdAt");

-- CreateIndex
CREATE INDEX "Item_partyId_isActive_normalizedName_idx" ON "Item"("partyId", "isActive", "normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "Item_partyId_normalizedName_key" ON "Item"("partyId", "normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "Item_partyId_id_key" ON "Item"("partyId", "id");

-- CreateIndex
CREATE INDEX "Raid_partyId_instanceId_idx" ON "Raid"("partyId", "instanceId");

-- CreateIndex
CREATE INDEX "Raid_partyId_stageId_occurredAt_idx" ON "Raid"("partyId", "stageId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Raid_partyId_creationKey_key" ON "Raid"("partyId", "creationKey");

-- AddForeignKey
ALTER TABLE "Party" ADD CONSTRAINT "Party_selectedStageId_fkey" FOREIGN KEY ("selectedStageId") REFERENCES "ServerStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Raid" ADD CONSTRAINT "Raid_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Raid" ADD CONSTRAINT "Raid_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ServerStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instance" ADD CONSTRAINT "Instance_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerStageConfig" ADD CONSTRAINT "ServerStageConfig_explicitCurrentStageId_fkey" FOREIGN KEY ("explicitCurrentStageId") REFERENCES "ServerStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstanceStageLootRecommendation" ADD CONSTRAINT "InstanceStageLootRecommendation_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstanceStageLootRecommendation" ADD CONSTRAINT "InstanceStageLootRecommendation_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ServerStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstanceStageLootRecommendation" ADD CONSTRAINT "InstanceStageLootRecommendation_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyInstanceLootPreset" ADD CONSTRAINT "PartyInstanceLootPreset_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyInstanceLootPreset" ADD CONSTRAINT "PartyInstanceLootPreset_partyId_instanceId_fkey" FOREIGN KEY ("partyId", "instanceId") REFERENCES "Instance"("partyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyInstanceLootPresetItem" ADD CONSTRAINT "PartyInstanceLootPresetItem_partyId_presetId_fkey" FOREIGN KEY ("partyId", "presetId") REFERENCES "PartyInstanceLootPreset"("partyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyInstanceLootPresetItem" ADD CONSTRAINT "PartyInstanceLootPresetItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyQuickLootItem" ADD CONSTRAINT "PartyQuickLootItem_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyQuickLootItem" ADD CONSTRAINT "PartyQuickLootItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerStageAuditEvent" ADD CONSTRAINT "ServerStageAuditEvent_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ServerStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
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
COMMIT;\n