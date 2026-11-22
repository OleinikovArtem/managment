ALTER TABLE "LedgerTransaction" ADD COLUMN "voidedAt" TIMESTAMP(3);

ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_voided_payout_only"
CHECK ("voidedAt" IS NULL OR (type = 'PAYOUT_POSTED' AND status = 'POSTED' AND "postedAt" IS NOT NULL));

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
    IF raid_locked IS NOT NULL THEN
      IF TG_TABLE_NAME = 'LootDrop' AND TG_OP = 'DELETE' AND NOT EXISTS (
        SELECT 1 FROM "SaleTransaction" WHERE "partyId" = OLD."partyId" AND "lootDropId" = OLD.id
      ) THEN RETURN OLD; END IF;
      RAISE EXCEPTION 'Raid data is locked by financial history';
    END IF;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    SELECT "lockedAt" INTO raid_locked FROM "Raid" WHERE "partyId" = NEW."partyId" AND id = NEW."raidId";
    IF raid_locked IS NOT NULL THEN RAISE EXCEPTION 'Raid data is locked by financial history'; END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

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
    IF record_data->>'status' = 'POSTED' THEN
      IF TG_OP = 'UPDATE' AND OLD.type = 'PAYOUT_POSTED'
        AND OLD."voidedAt" IS NULL AND NEW."voidedAt" IS NOT NULL
        AND (to_jsonb(NEW) - 'voidedAt') = (record_data - 'voidedAt')
      THEN RETURN NEW; END IF;
      RAISE EXCEPTION 'Posted ledger transaction is immutable';
    END IF;
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
