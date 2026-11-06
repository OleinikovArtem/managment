-- Additional database guards for invariants Prisma cannot express in its schema.
-- Safe to execute again after every Prisma schema deployment.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PartyMember_distributionWeight_positive') THEN
    ALTER TABLE "PartyMember" ADD CONSTRAINT "PartyMember_distributionWeight_positive" CHECK ("distributionWeight" > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RaidParticipant_distributionWeight_positive') THEN
    ALTER TABLE "RaidParticipant" ADD CONSTRAINT "RaidParticipant_distributionWeight_positive" CHECK ("distributionWeight" > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LootDrop_quantity_positive') THEN
    ALTER TABLE "LootDrop" ADD CONSTRAINT "LootDrop_quantity_positive" CHECK (quantity > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SaleTransaction_values_positive') THEN
    ALTER TABLE "SaleTransaction" ADD CONSTRAINT "SaleTransaction_values_positive" CHECK ("quantitySold" > 0 AND "totalPrice" > 0 AND "algorithmVersion" > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SaleShare_values_valid') THEN
    ALTER TABLE "SaleShare" ADD CONSTRAINT "SaleShare_values_valid" CHECK (amount >= 0 AND "weightSnapshot" > 0 AND "algorithmVersion" > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MemberPayment_amount_positive') THEN
    ALTER TABLE "MemberPayment" ADD CONSTRAINT "MemberPayment_amount_positive" CHECK (amount > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentAllocation_amount_positive') THEN
    ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_amount_positive" CHECK (amount > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LedgerEntry_amounts_nonnegative') THEN
    ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_amounts_nonnegative" CHECK (debit >= 0 AND credit >= 0 AND (debit > 0 OR credit > 0) AND NOT (debit > 0 AND credit > 0));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION pbm_is_party_reset() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(current_setting('app.party_reset', true), '') = 'on'
$$;

CREATE OR REPLACE FUNCTION pbm_prevent_locked_raid_changes() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  affected_party text;
  affected_raid text;
  raid_locked timestamptz;
BEGIN
  IF pbm_is_party_reset() THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP <> 'INSERT' THEN
    SELECT "lockedAt" INTO raid_locked FROM "Raid" WHERE "partyId" = OLD."partyId" AND id = OLD."raidId";
    IF raid_locked IS NOT NULL THEN RAISE EXCEPTION 'Raid data is locked by financial history'; END IF;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    SELECT "lockedAt" INTO raid_locked FROM "Raid" WHERE "partyId" = NEW."partyId" AND id = NEW."raidId";
    IF raid_locked IS NOT NULL THEN RAISE EXCEPTION 'Raid data is locked by financial history'; END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS RaidParticipant_locked_guard ON "RaidParticipant";
CREATE TRIGGER RaidParticipant_locked_guard BEFORE INSERT OR UPDATE OR DELETE ON "RaidParticipant"
FOR EACH ROW EXECUTE FUNCTION pbm_prevent_locked_raid_changes();
DROP TRIGGER IF EXISTS LootDrop_locked_guard ON "LootDrop";
CREATE TRIGGER LootDrop_locked_guard BEFORE INSERT OR UPDATE OR DELETE ON "LootDrop"
FOR EACH ROW EXECUTE FUNCTION pbm_prevent_locked_raid_changes();

CREATE OR REPLACE FUNCTION pbm_keep_raid_lock() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT pbm_is_party_reset() AND OLD."lockedAt" IS NOT NULL AND NEW."lockedAt" IS NULL THEN
    RAISE EXCEPTION 'Raid financial lock cannot be removed';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS Raid_lockedAt_immutable ON "Raid";
CREATE TRIGGER Raid_lockedAt_immutable BEFORE UPDATE OF "lockedAt" ON "Raid"
FOR EACH ROW EXECUTE FUNCTION pbm_keep_raid_lock();

CREATE OR REPLACE FUNCTION pbm_prevent_posted_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  record_data jsonb;
  party_id text;
  related_id text;
  posted boolean;
BEGIN
  IF pbm_is_party_reset() THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF TG_TABLE_NAME = 'LedgerTransaction' AND (
      NEW.status <> 'DRAFT' OR NEW."postedAt" IS NOT NULL
      OR (NEW."saleTransactionId" IS NULL) = (NEW."memberPaymentId" IS NULL)
      OR (NEW.type = 'SALE_POSTED' AND NEW."saleTransactionId" IS NULL)
      OR (NEW.type = 'PAYOUT_POSTED' AND NEW."memberPaymentId" IS NULL)
    ) THEN RAISE EXCEPTION 'LedgerTransaction must start as a valid DRAFT'; END IF;
    RETURN NEW;
  END IF;

  record_data := to_jsonb(OLD);
  party_id := record_data->>'partyId';
  IF TG_TABLE_NAME = 'LedgerTransaction' THEN
    IF record_data->>'status' = 'POSTED' THEN RAISE EXCEPTION 'Posted ledger transaction is immutable'; END IF;
    IF (NEW.status = 'DRAFT' AND NEW."postedAt" IS NOT NULL)
      OR (NEW.status = 'POSTED' AND NEW."postedAt" IS NULL)
      OR (NEW."saleTransactionId" IS NULL) = (NEW."memberPaymentId" IS NULL)
      OR (NEW.type = 'SALE_POSTED' AND NEW."saleTransactionId" IS NULL)
      OR (NEW.type = 'PAYOUT_POSTED' AND NEW."memberPaymentId" IS NULL) THEN
      RAISE EXCEPTION 'Invalid LedgerTransaction state or source';
    END IF;
    RETURN NEW;
  ELSIF TG_TABLE_NAME = 'LedgerEntry' THEN
    related_id := record_data->>'ledgerTransactionId';
    SELECT EXISTS (SELECT 1 FROM "LedgerTransaction" WHERE "partyId" = party_id AND id = related_id AND status = 'POSTED') INTO posted;
  ELSIF TG_TABLE_NAME = 'SaleTransaction' THEN
    related_id := record_data->>'id';
    SELECT EXISTS (SELECT 1 FROM "LedgerTransaction" WHERE "partyId" = party_id AND "saleTransactionId" = related_id AND status = 'POSTED') INTO posted;
  ELSIF TG_TABLE_NAME = 'SaleShare' THEN
    related_id := record_data->>'saleTransactionId';
    SELECT EXISTS (SELECT 1 FROM "LedgerTransaction" WHERE "partyId" = party_id AND "saleTransactionId" = related_id AND status = 'POSTED') INTO posted;
  ELSIF TG_TABLE_NAME = 'MemberPayment' THEN
    related_id := record_data->>'id';
    SELECT EXISTS (SELECT 1 FROM "LedgerTransaction" WHERE "partyId" = party_id AND "memberPaymentId" = related_id AND status = 'POSTED') INTO posted;
  ELSIF TG_TABLE_NAME = 'PaymentAllocation' THEN
    related_id := record_data->>'memberPaymentId';
    SELECT EXISTS (SELECT 1 FROM "LedgerTransaction" WHERE "partyId" = party_id AND "memberPaymentId" = related_id AND status = 'POSTED') INTO posted;
  END IF;

  IF posted THEN RAISE EXCEPTION 'Posted financial history is immutable'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['LedgerTransaction','LedgerEntry','SaleTransaction','SaleShare','MemberPayment','PaymentAllocation'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', table_name || '_posted_guard', table_name);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION pbm_prevent_posted_mutation()', table_name || '_posted_guard', table_name);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION pbm_check_oversell() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  available integer;
  already_sold integer;
BEGIN
  SELECT quantity INTO available FROM "LootDrop"
  WHERE "partyId" = NEW."partyId" AND id = NEW."lootDropId" FOR UPDATE;
  SELECT COALESCE(SUM("quantitySold"), 0)::integer INTO already_sold FROM "SaleTransaction"
  WHERE "partyId" = NEW."partyId" AND "lootDropId" = NEW."lootDropId"
    AND id <> COALESCE(NEW.id, '');
  IF available IS NULL OR already_sold + NEW."quantitySold" > available THEN
    RAISE EXCEPTION 'SaleTransaction exceeds available LootDrop quantity';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS SaleTransaction_oversell_guard ON "SaleTransaction";
CREATE TRIGGER SaleTransaction_oversell_guard BEFORE INSERT OR UPDATE OF "quantitySold", "partyId", "lootDropId" ON "SaleTransaction"
FOR EACH ROW EXECUTE FUNCTION pbm_check_oversell();

CREATE OR REPLACE FUNCTION pbm_check_ledger_balance() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE total_debit numeric;
        total_credit numeric;
        source_total numeric;
        related_total numeric;
BEGIN
  IF NEW.status <> 'POSTED' OR OLD.status = 'POSTED' THEN RETURN NEW; END IF;

  SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
  INTO total_debit, total_credit FROM "LedgerEntry"
  WHERE "partyId" = NEW."partyId" AND "ledgerTransactionId" = NEW.id;
  IF total_debit <= 0 OR total_debit <> total_credit THEN
    RAISE EXCEPTION 'LedgerTransaction entries must balance';
  END IF;

  IF NEW.type = 'SALE_POSTED' THEN
    SELECT "totalPrice" INTO source_total FROM "SaleTransaction"
    WHERE "partyId" = NEW."partyId" AND id = NEW."saleTransactionId";
    SELECT COALESCE(SUM(amount), 0) INTO related_total FROM "SaleShare"
    WHERE "partyId" = NEW."partyId" AND "saleTransactionId" = NEW."saleTransactionId";
  ELSE
    SELECT amount INTO source_total FROM "MemberPayment"
    WHERE "partyId" = NEW."partyId" AND id = NEW."memberPaymentId";
    SELECT COALESCE(SUM(amount), 0) INTO related_total FROM "PaymentAllocation"
    WHERE "partyId" = NEW."partyId" AND "memberPaymentId" = NEW."memberPaymentId";
  END IF;
  IF source_total IS NULL OR related_total <> source_total THEN
    RAISE EXCEPTION 'Ledger source and allocations do not balance';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS LedgerTransaction_balanced_post ON "LedgerTransaction";
CREATE TRIGGER LedgerTransaction_balanced_post BEFORE UPDATE OF status ON "LedgerTransaction"
FOR EACH ROW EXECUTE FUNCTION pbm_check_ledger_balance();
