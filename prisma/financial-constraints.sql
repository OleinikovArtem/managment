DROP TRIGGER IF EXISTS PartyMember_distributionWeight_insert;
DROP TRIGGER IF EXISTS PartyMember_distributionWeight_update;
DROP TRIGGER IF EXISTS RaidParticipant_distributionWeight_insert;
DROP TRIGGER IF EXISTS RaidParticipant_distributionWeight_update;
DROP TRIGGER IF EXISTS LootDrop_quantity_insert;
DROP TRIGGER IF EXISTS LootDrop_quantity_update;
DROP TRIGGER IF EXISTS RaidParticipant_locked_insert;
DROP TRIGGER IF EXISTS RaidParticipant_locked_update;
DROP TRIGGER IF EXISTS RaidParticipant_locked_delete;
DROP TRIGGER IF EXISTS LootDrop_locked_insert;
DROP TRIGGER IF EXISTS LootDrop_locked_financial_update;
DROP TRIGGER IF EXISTS LootDrop_locked_delete;
DROP TRIGGER IF EXISTS Raid_lockedAt_immutable;
DROP TRIGGER IF EXISTS SaleTransaction_values_insert;
DROP TRIGGER IF EXISTS SaleTransaction_values_update;
DROP TRIGGER IF EXISTS SaleTransaction_oversell_insert;
DROP TRIGGER IF EXISTS SaleTransaction_oversell_update;
DROP TRIGGER IF EXISTS SaleTransaction_posted_insert;
DROP TRIGGER IF EXISTS SaleTransaction_posted_update;
DROP TRIGGER IF EXISTS SaleTransaction_posted_delete;
DROP TRIGGER IF EXISTS SaleShare_values_insert;
DROP TRIGGER IF EXISTS SaleShare_values_update;
DROP TRIGGER IF EXISTS SaleShare_posted_insert;
DROP TRIGGER IF EXISTS SaleShare_posted_update;
DROP TRIGGER IF EXISTS SaleShare_posted_delete;
DROP TRIGGER IF EXISTS MemberPayment_values_insert;
DROP TRIGGER IF EXISTS MemberPayment_values_update;
DROP TRIGGER IF EXISTS MemberPayment_posted_update;
DROP TRIGGER IF EXISTS MemberPayment_posted_delete;
DROP TRIGGER IF EXISTS PaymentAllocation_values_insert;
DROP TRIGGER IF EXISTS PaymentAllocation_values_update;
DROP TRIGGER IF EXISTS PaymentAllocation_posted_insert;
DROP TRIGGER IF EXISTS PaymentAllocation_posted_update;
DROP TRIGGER IF EXISTS PaymentAllocation_posted_delete;
DROP TRIGGER IF EXISTS LedgerTransaction_source_insert;
DROP TRIGGER IF EXISTS LedgerTransaction_source_update;
DROP TRIGGER IF EXISTS LedgerTransaction_balanced_post;
DROP TRIGGER IF EXISTS LedgerTransaction_lock_raid;
DROP TRIGGER IF EXISTS LedgerTransaction_posted_delete;
DROP TRIGGER IF EXISTS LedgerEntry_source_insert;
DROP TRIGGER IF EXISTS LedgerEntry_source_update;
DROP TRIGGER IF EXISTS LedgerEntry_posted_delete;

CREATE TRIGGER IF NOT EXISTS PartyMember_distributionWeight_insert
BEFORE INSERT ON PartyMember
WHEN NEW.distributionWeight <= 0
BEGIN
  SELECT RAISE(ABORT, 'PartyMember distributionWeight must be positive');
END;

CREATE TRIGGER IF NOT EXISTS PartyMember_distributionWeight_update
BEFORE UPDATE OF distributionWeight ON PartyMember
WHEN NEW.distributionWeight <= 0
BEGIN
  SELECT RAISE(ABORT, 'PartyMember distributionWeight must be positive');
END;

CREATE TRIGGER IF NOT EXISTS RaidParticipant_distributionWeight_insert
BEFORE INSERT ON RaidParticipant
WHEN NEW.distributionWeight <= 0
BEGIN
  SELECT RAISE(ABORT, 'RaidParticipant distributionWeight must be positive');
END;

CREATE TRIGGER IF NOT EXISTS RaidParticipant_distributionWeight_update
BEFORE UPDATE OF distributionWeight ON RaidParticipant
WHEN NEW.distributionWeight <= 0
BEGIN
  SELECT RAISE(ABORT, 'RaidParticipant distributionWeight must be positive');
END;

CREATE TRIGGER IF NOT EXISTS LootDrop_quantity_insert
BEFORE INSERT ON LootDrop
WHEN NEW.quantity <= 0
BEGIN
  SELECT RAISE(ABORT, 'LootDrop quantity must be positive');
END;

CREATE TRIGGER IF NOT EXISTS LootDrop_quantity_update
BEFORE UPDATE OF quantity ON LootDrop
WHEN NEW.quantity <= 0
BEGIN
  SELECT RAISE(ABORT, 'LootDrop quantity must be positive');
END;

CREATE TRIGGER IF NOT EXISTS RaidParticipant_locked_insert
BEFORE INSERT ON RaidParticipant
WHEN EXISTS (
  SELECT 1
  FROM Raid
  WHERE partyId = NEW.partyId AND id = NEW.raidId AND lockedAt IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'Raid attendance is locked by financial history');
END;

CREATE TRIGGER IF NOT EXISTS RaidParticipant_locked_update
BEFORE UPDATE ON RaidParticipant
WHEN EXISTS (
  SELECT 1
  FROM Raid
  WHERE partyId = OLD.partyId AND id = OLD.raidId AND lockedAt IS NOT NULL
)
OR EXISTS (
  SELECT 1
  FROM Raid
  WHERE partyId = NEW.partyId AND id = NEW.raidId AND lockedAt IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'Raid attendance is locked by financial history');
END;

CREATE TRIGGER IF NOT EXISTS RaidParticipant_locked_delete
BEFORE DELETE ON RaidParticipant
WHEN EXISTS (
  SELECT 1
  FROM Raid
  WHERE partyId = OLD.partyId AND id = OLD.raidId AND lockedAt IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'Raid attendance is locked by financial history');
END;

CREATE TRIGGER IF NOT EXISTS LootDrop_locked_insert
BEFORE INSERT ON LootDrop
WHEN EXISTS (
  SELECT 1
  FROM Raid
  WHERE partyId = NEW.partyId AND id = NEW.raidId AND lockedAt IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'Raid loot is locked by financial history');
END;

CREATE TRIGGER IF NOT EXISTS LootDrop_locked_financial_update
BEFORE UPDATE OF partyId, raidId, itemId, quantity ON LootDrop
WHEN EXISTS (
  SELECT 1
  FROM Raid
  WHERE partyId = OLD.partyId AND id = OLD.raidId AND lockedAt IS NOT NULL
)
OR EXISTS (
  SELECT 1
  FROM Raid
  WHERE partyId = NEW.partyId AND id = NEW.raidId AND lockedAt IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'Raid loot is locked by financial history');
END;

CREATE TRIGGER IF NOT EXISTS LootDrop_locked_delete
BEFORE DELETE ON LootDrop
WHEN EXISTS (
  SELECT 1
  FROM Raid
  WHERE partyId = OLD.partyId AND id = OLD.raidId AND lockedAt IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'Raid loot is locked by financial history');
END;

CREATE TRIGGER IF NOT EXISTS Raid_lockedAt_immutable
BEFORE UPDATE OF lockedAt ON Raid
WHEN OLD.lockedAt IS NOT NULL AND NEW.lockedAt IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Raid financial lock cannot be removed');
END;

CREATE TRIGGER IF NOT EXISTS SaleTransaction_values_insert
BEFORE INSERT ON SaleTransaction
WHEN NEW.quantitySold <= 0
  OR NEW.totalPrice <= 0
  OR NEW.algorithmVersion <= 0
  OR NEW.distributionMethod NOT IN ('WEIGHTED')
BEGIN
  SELECT RAISE(ABORT, 'SaleTransaction values must be positive');
END;

CREATE TRIGGER IF NOT EXISTS SaleTransaction_values_update
BEFORE UPDATE ON SaleTransaction
WHEN NEW.quantitySold <= 0
  OR NEW.totalPrice <= 0
  OR NEW.algorithmVersion <= 0
  OR NEW.distributionMethod NOT IN ('WEIGHTED')
BEGIN
  SELECT RAISE(ABORT, 'SaleTransaction values must be positive');
END;

CREATE TRIGGER IF NOT EXISTS SaleTransaction_oversell_insert
BEFORE INSERT ON SaleTransaction
WHEN NEW.quantitySold + COALESCE((
  SELECT SUM(quantitySold) FROM SaleTransaction
  WHERE partyId = NEW.partyId AND lootDropId = NEW.lootDropId
), 0) > COALESCE((
  SELECT quantity FROM LootDrop
  WHERE partyId = NEW.partyId AND raidId = NEW.raidId AND id = NEW.lootDropId
), 0)
BEGIN
  SELECT RAISE(ABORT, 'SaleTransaction exceeds available LootDrop quantity');
END;

CREATE TRIGGER IF NOT EXISTS SaleTransaction_oversell_update
BEFORE UPDATE OF quantitySold, partyId, raidId, lootDropId ON SaleTransaction
WHEN NEW.quantitySold + COALESCE((
  SELECT SUM(quantitySold) FROM SaleTransaction
  WHERE partyId = NEW.partyId
    AND lootDropId = NEW.lootDropId
    AND id <> OLD.id
), 0) > COALESCE((
  SELECT quantity FROM LootDrop
  WHERE partyId = NEW.partyId AND raidId = NEW.raidId AND id = NEW.lootDropId
), 0)
BEGIN
  SELECT RAISE(ABORT, 'SaleTransaction exceeds available LootDrop quantity');
END;

CREATE TRIGGER IF NOT EXISTS SaleTransaction_posted_insert
BEFORE INSERT ON SaleTransaction
WHEN EXISTS (
  SELECT 1
  FROM LedgerTransaction
  WHERE partyId = NEW.partyId
    AND saleTransactionId = NEW.id
    AND status = 'POSTED'
)
BEGIN
  SELECT RAISE(ABORT, 'Posted sale is immutable');
END;

CREATE TRIGGER IF NOT EXISTS SaleTransaction_posted_update
BEFORE UPDATE ON SaleTransaction
WHEN EXISTS (
  SELECT 1
  FROM LedgerTransaction
  WHERE partyId = OLD.partyId
    AND saleTransactionId = OLD.id
    AND status = 'POSTED'
)
BEGIN
  SELECT RAISE(ABORT, 'Posted sale is immutable');
END;

CREATE TRIGGER IF NOT EXISTS SaleTransaction_posted_delete
BEFORE DELETE ON SaleTransaction
WHEN EXISTS (
  SELECT 1
  FROM LedgerTransaction
  WHERE partyId = OLD.partyId
    AND saleTransactionId = OLD.id
    AND status = 'POSTED'
)
BEGIN
  SELECT RAISE(ABORT, 'Posted sale is immutable');
END;

CREATE TRIGGER IF NOT EXISTS SaleShare_values_insert
BEFORE INSERT ON SaleShare
WHEN NEW.amount < 0
  OR NEW.weightSnapshot <= 0
  OR NEW.algorithmVersion <= 0
  OR NEW.distributionMethod NOT IN ('WEIGHTED')
  OR NOT EXISTS (
    SELECT 1 FROM RaidParticipant AS participant
    JOIN SaleTransaction AS sale
      ON sale.partyId = NEW.partyId
     AND sale.raidId = NEW.raidId
     AND sale.id = NEW.saleTransactionId
    WHERE participant.partyId = NEW.partyId
      AND participant.raidId = NEW.raidId
      AND participant.id = NEW.raidParticipantId
      AND participant.memberId = NEW.memberId
      AND participant.status = 'PRESENT'
      AND participant.distributionWeight = NEW.weightSnapshot
      AND participant.nicknameSnapshot = NEW.nicknameSnapshot
      AND sale.distributionMethod = NEW.distributionMethod
      AND sale.algorithmVersion = NEW.algorithmVersion
  )
BEGIN
  SELECT RAISE(ABORT, 'SaleShare snapshot or amount is invalid');
END;

CREATE TRIGGER IF NOT EXISTS SaleShare_values_update
BEFORE UPDATE ON SaleShare
WHEN NEW.amount < 0
  OR NEW.weightSnapshot <= 0
  OR NEW.algorithmVersion <= 0
  OR NEW.distributionMethod NOT IN ('WEIGHTED')
  OR NOT EXISTS (
    SELECT 1 FROM RaidParticipant AS participant
    JOIN SaleTransaction AS sale
      ON sale.partyId = NEW.partyId
     AND sale.raidId = NEW.raidId
     AND sale.id = NEW.saleTransactionId
    WHERE participant.partyId = NEW.partyId
      AND participant.raidId = NEW.raidId
      AND participant.id = NEW.raidParticipantId
      AND participant.memberId = NEW.memberId
      AND participant.status = 'PRESENT'
      AND participant.distributionWeight = NEW.weightSnapshot
      AND participant.nicknameSnapshot = NEW.nicknameSnapshot
      AND sale.distributionMethod = NEW.distributionMethod
      AND sale.algorithmVersion = NEW.algorithmVersion
  )
BEGIN
  SELECT RAISE(ABORT, 'SaleShare snapshot or amount is invalid');
END;

CREATE TRIGGER IF NOT EXISTS SaleShare_posted_insert
BEFORE INSERT ON SaleShare
WHEN EXISTS (
  SELECT 1 FROM LedgerTransaction
  WHERE partyId = NEW.partyId
    AND saleTransactionId = NEW.saleTransactionId
    AND status = 'POSTED'
)
BEGIN
  SELECT RAISE(ABORT, 'Posted sale shares are immutable');
END;

CREATE TRIGGER IF NOT EXISTS SaleShare_posted_update
BEFORE UPDATE ON SaleShare
WHEN EXISTS (
  SELECT 1 FROM LedgerTransaction
  WHERE partyId = OLD.partyId
    AND saleTransactionId = OLD.saleTransactionId
    AND status = 'POSTED'
)
OR EXISTS (
  SELECT 1 FROM LedgerTransaction
  WHERE partyId = NEW.partyId
    AND saleTransactionId = NEW.saleTransactionId
    AND status = 'POSTED'
)
BEGIN
  SELECT RAISE(ABORT, 'Posted sale shares are immutable');
END;

CREATE TRIGGER IF NOT EXISTS SaleShare_posted_delete
BEFORE DELETE ON SaleShare
WHEN EXISTS (
  SELECT 1 FROM LedgerTransaction
  WHERE partyId = OLD.partyId
    AND saleTransactionId = OLD.saleTransactionId
    AND status = 'POSTED'
)
BEGIN
  SELECT RAISE(ABORT, 'Posted sale shares are immutable');
END;

CREATE TRIGGER IF NOT EXISTS MemberPayment_values_insert
BEFORE INSERT ON MemberPayment
WHEN NEW.amount <= 0
BEGIN
  SELECT RAISE(ABORT, 'MemberPayment amount must be positive');
END;

CREATE TRIGGER IF NOT EXISTS MemberPayment_values_update
BEFORE UPDATE OF amount ON MemberPayment
WHEN NEW.amount <= 0
BEGIN
  SELECT RAISE(ABORT, 'MemberPayment amount must be positive');
END;

CREATE TRIGGER IF NOT EXISTS MemberPayment_posted_update
BEFORE UPDATE ON MemberPayment
WHEN EXISTS (
  SELECT 1 FROM LedgerTransaction
  WHERE partyId = OLD.partyId
    AND memberPaymentId = OLD.id
    AND status = 'POSTED'
)
BEGIN
  SELECT RAISE(ABORT, 'Posted payment is immutable');
END;

CREATE TRIGGER IF NOT EXISTS MemberPayment_posted_delete
BEFORE DELETE ON MemberPayment
WHEN EXISTS (
  SELECT 1 FROM LedgerTransaction
  WHERE partyId = OLD.partyId
    AND memberPaymentId = OLD.id
    AND status = 'POSTED'
)
BEGIN
  SELECT RAISE(ABORT, 'Posted payment is immutable');
END;

CREATE TRIGGER IF NOT EXISTS PaymentAllocation_values_insert
BEFORE INSERT ON PaymentAllocation
WHEN NEW.amount <= 0
BEGIN
  SELECT RAISE(ABORT, 'PaymentAllocation amount must be positive');
END;

CREATE TRIGGER IF NOT EXISTS PaymentAllocation_values_update
BEFORE UPDATE OF amount ON PaymentAllocation
WHEN NEW.amount <= 0
BEGIN
  SELECT RAISE(ABORT, 'PaymentAllocation amount must be positive');
END;

CREATE TRIGGER IF NOT EXISTS PaymentAllocation_posted_insert
BEFORE INSERT ON PaymentAllocation
WHEN EXISTS (
  SELECT 1 FROM LedgerTransaction
  WHERE partyId = NEW.partyId
    AND memberPaymentId = NEW.memberPaymentId
    AND status = 'POSTED'
)
BEGIN
  SELECT RAISE(ABORT, 'Posted payment allocations are immutable');
END;

CREATE TRIGGER IF NOT EXISTS PaymentAllocation_posted_update
BEFORE UPDATE ON PaymentAllocation
WHEN EXISTS (
  SELECT 1 FROM LedgerTransaction
  WHERE partyId = OLD.partyId
    AND memberPaymentId = OLD.memberPaymentId
    AND status = 'POSTED'
)
OR EXISTS (
  SELECT 1 FROM LedgerTransaction
  WHERE partyId = NEW.partyId
    AND memberPaymentId = NEW.memberPaymentId
    AND status = 'POSTED'
)
BEGIN
  SELECT RAISE(ABORT, 'Posted payment allocations are immutable');
END;

CREATE TRIGGER IF NOT EXISTS PaymentAllocation_posted_delete
BEFORE DELETE ON PaymentAllocation
WHEN EXISTS (
  SELECT 1 FROM LedgerTransaction
  WHERE partyId = OLD.partyId
    AND memberPaymentId = OLD.memberPaymentId
    AND status = 'POSTED'
)
BEGIN
  SELECT RAISE(ABORT, 'Posted payment allocations are immutable');
END;

CREATE TRIGGER IF NOT EXISTS LedgerTransaction_source_insert
BEFORE INSERT ON LedgerTransaction
WHEN (NEW.saleTransactionId IS NULL AND NEW.memberPaymentId IS NULL)
  OR (NEW.saleTransactionId IS NOT NULL AND NEW.memberPaymentId IS NOT NULL)
  OR NEW.type NOT IN ('SALE_POSTED', 'PAYOUT_POSTED')
  OR (NEW.type = 'SALE_POSTED' AND NEW.saleTransactionId IS NULL)
  OR (NEW.type = 'PAYOUT_POSTED' AND NEW.memberPaymentId IS NULL)
  OR NEW.status <> 'DRAFT'
  OR NEW.postedAt IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'LedgerTransaction must start as a valid DRAFT');
END;

CREATE TRIGGER IF NOT EXISTS LedgerTransaction_source_update
BEFORE UPDATE ON LedgerTransaction
WHEN OLD.status = 'POSTED'
  OR (NEW.saleTransactionId IS NULL AND NEW.memberPaymentId IS NULL)
  OR (NEW.saleTransactionId IS NOT NULL AND NEW.memberPaymentId IS NOT NULL)
  OR NEW.type NOT IN ('SALE_POSTED', 'PAYOUT_POSTED')
  OR NEW.status NOT IN ('DRAFT', 'POSTED')
  OR (NEW.type = 'SALE_POSTED' AND NEW.saleTransactionId IS NULL)
  OR (NEW.type = 'PAYOUT_POSTED' AND NEW.memberPaymentId IS NULL)
  OR (NEW.status = 'DRAFT' AND NEW.postedAt IS NOT NULL)
  OR (NEW.status = 'POSTED' AND NEW.postedAt IS NULL)
  OR (OLD.status = 'POSTED' AND NEW.status <> 'POSTED')
BEGIN
  SELECT RAISE(ABORT, 'Invalid or immutable LedgerTransaction');
END;

CREATE TRIGGER IF NOT EXISTS LedgerTransaction_balanced_post
BEFORE UPDATE OF status ON LedgerTransaction
WHEN NEW.status = 'POSTED'
BEGIN
  SELECT CASE
    WHEN COALESCE((
      SELECT SUM(debit) FROM LedgerEntry
      WHERE partyId = NEW.partyId AND ledgerTransactionId = NEW.id
    ), 0) <= 0
    OR COALESCE((
      SELECT SUM(debit) FROM LedgerEntry
      WHERE partyId = NEW.partyId AND ledgerTransactionId = NEW.id
    ), 0) <> COALESCE((
      SELECT SUM(credit) FROM LedgerEntry
      WHERE partyId = NEW.partyId AND ledgerTransactionId = NEW.id
    ), 0)
    THEN RAISE(ABORT, 'LedgerTransaction entries must balance')
  END;

  SELECT CASE
    WHEN NEW.type = 'SALE_POSTED' AND (
      (SELECT COALESCE(SUM(debit), 0) FROM LedgerEntry
       WHERE partyId = NEW.partyId AND ledgerTransactionId = NEW.id
         AND accountType = 'PARTY_CASH') <>
      (SELECT totalPrice FROM SaleTransaction
       WHERE partyId = NEW.partyId AND id = NEW.saleTransactionId)
      OR
      (SELECT COALESCE(SUM(credit), 0) FROM LedgerEntry
       WHERE partyId = NEW.partyId AND ledgerTransactionId = NEW.id
         AND accountType = 'MEMBER_PAYABLE') <>
      (SELECT totalPrice FROM SaleTransaction
       WHERE partyId = NEW.partyId AND id = NEW.saleTransactionId)
      OR
      (SELECT COALESCE(SUM(credit), 0) FROM LedgerEntry
       WHERE partyId = NEW.partyId AND ledgerTransactionId = NEW.id
         AND accountType = 'PARTY_CASH') <> 0
      OR
      (SELECT COALESCE(SUM(debit), 0) FROM LedgerEntry
       WHERE partyId = NEW.partyId AND ledgerTransactionId = NEW.id
         AND accountType = 'MEMBER_PAYABLE') <> 0
      OR
      (SELECT COALESCE(SUM(amount), 0) FROM SaleShare
       WHERE partyId = NEW.partyId AND saleTransactionId = NEW.saleTransactionId) <>
      (SELECT totalPrice FROM SaleTransaction
       WHERE partyId = NEW.partyId AND id = NEW.saleTransactionId)
    )
    THEN RAISE(ABORT, 'SALE_POSTED ledger does not match sale and shares')
  END;

  SELECT CASE
    WHEN NEW.type = 'SALE_POSTED' AND EXISTS (
      SELECT 1 FROM SaleShare AS share
      WHERE share.partyId = NEW.partyId
        AND share.saleTransactionId = NEW.saleTransactionId
        AND share.amount <> COALESCE((
          SELECT SUM(entry.credit) FROM LedgerEntry AS entry
          WHERE entry.partyId = NEW.partyId
            AND entry.ledgerTransactionId = NEW.id
            AND entry.accountType = 'MEMBER_PAYABLE'
            AND entry.partyMemberId = share.memberId
        ), 0)
    )
    THEN RAISE(ABORT, 'SALE_POSTED member ledger entries do not match shares')
  END;

  SELECT CASE
    WHEN NEW.type = 'SALE_POSTED' AND EXISTS (
      SELECT 1 FROM LedgerEntry AS entry
      WHERE entry.partyId = NEW.partyId
        AND entry.ledgerTransactionId = NEW.id
        AND entry.accountType = 'MEMBER_PAYABLE'
      GROUP BY entry.partyMemberId
      HAVING SUM(entry.credit) <> COALESCE((
        SELECT SUM(share.amount) FROM SaleShare AS share
        WHERE share.partyId = NEW.partyId
          AND share.saleTransactionId = NEW.saleTransactionId
          AND share.memberId = entry.partyMemberId
      ), 0)
    )
    THEN RAISE(ABORT, 'SALE_POSTED contains an unallocated member payable')
  END;

  SELECT CASE
    WHEN NEW.type = 'PAYOUT_POSTED' AND (
      (SELECT COALESCE(SUM(credit), 0) FROM LedgerEntry
       WHERE partyId = NEW.partyId AND ledgerTransactionId = NEW.id
         AND accountType = 'PARTY_CASH') <>
      (SELECT amount FROM MemberPayment
       WHERE partyId = NEW.partyId AND id = NEW.memberPaymentId)
      OR
      (SELECT COALESCE(SUM(debit), 0) FROM LedgerEntry
       WHERE partyId = NEW.partyId AND ledgerTransactionId = NEW.id
         AND accountType = 'MEMBER_PAYABLE') <>
      (SELECT amount FROM MemberPayment
       WHERE partyId = NEW.partyId AND id = NEW.memberPaymentId)
      OR
      (SELECT COALESCE(SUM(debit), 0) FROM LedgerEntry
       WHERE partyId = NEW.partyId AND ledgerTransactionId = NEW.id
         AND accountType = 'PARTY_CASH') <> 0
      OR
      (SELECT COALESCE(SUM(credit), 0) FROM LedgerEntry
       WHERE partyId = NEW.partyId AND ledgerTransactionId = NEW.id
         AND accountType = 'MEMBER_PAYABLE') <> 0
      OR
      (SELECT COALESCE(SUM(amount), 0) FROM PaymentAllocation
       WHERE partyId = NEW.partyId AND memberPaymentId = NEW.memberPaymentId) <>
      (SELECT amount FROM MemberPayment
       WHERE partyId = NEW.partyId AND id = NEW.memberPaymentId)
    )
    THEN RAISE(ABORT, 'PAYOUT_POSTED ledger does not match payment and allocations')
  END;

  SELECT CASE
    WHEN NEW.type = 'PAYOUT_POSTED' AND EXISTS (
      SELECT allocation.memberId FROM PaymentAllocation AS allocation
      WHERE allocation.partyId = NEW.partyId
        AND allocation.memberPaymentId = NEW.memberPaymentId
      GROUP BY allocation.memberId
      HAVING SUM(allocation.amount) <> COALESCE((
          SELECT SUM(entry.debit) FROM LedgerEntry AS entry
          WHERE entry.partyId = NEW.partyId
            AND entry.ledgerTransactionId = NEW.id
            AND entry.accountType = 'MEMBER_PAYABLE'
            AND entry.partyMemberId = allocation.memberId
        ), 0)
    )
    THEN RAISE(ABORT, 'PAYOUT_POSTED member ledger entries do not match allocations')
  END;

  SELECT CASE
    WHEN NEW.type = 'PAYOUT_POSTED' AND EXISTS (
      SELECT 1 FROM LedgerEntry AS entry
      WHERE entry.partyId = NEW.partyId
        AND entry.ledgerTransactionId = NEW.id
        AND entry.accountType = 'MEMBER_PAYABLE'
      GROUP BY entry.partyMemberId
      HAVING SUM(entry.debit) <> COALESCE((
        SELECT SUM(allocation.amount) FROM PaymentAllocation AS allocation
        WHERE allocation.partyId = NEW.partyId
          AND allocation.memberPaymentId = NEW.memberPaymentId
          AND allocation.memberId = entry.partyMemberId
      ), 0)
    )
    THEN RAISE(ABORT, 'PAYOUT_POSTED contains an unallocated member debit')
  END;

  SELECT CASE
    WHEN NEW.type = 'PAYOUT_POSTED' AND (
      SELECT amount FROM MemberPayment
      WHERE partyId = NEW.partyId AND id = NEW.memberPaymentId
    ) > COALESCE((
      SELECT SUM(entry.debit - entry.credit)
      FROM LedgerEntry AS entry
      JOIN LedgerTransaction AS ledgerTx
        ON ledgerTx.partyId = entry.partyId
       AND ledgerTx.id = entry.ledgerTransactionId
      WHERE entry.partyId = NEW.partyId
        AND entry.accountType = 'PARTY_CASH'
        AND ledgerTx.status = 'POSTED'
    ), 0)
    THEN RAISE(ABORT, 'PAYOUT_POSTED exceeds available party cash')
  END;

  SELECT CASE
    WHEN NEW.type = 'PAYOUT_POSTED' AND EXISTS (
      SELECT 1 FROM PaymentAllocation AS currentAllocation
      WHERE currentAllocation.partyId = NEW.partyId
        AND currentAllocation.memberPaymentId = NEW.memberPaymentId
        AND (
          SELECT COALESCE(SUM(previousAllocation.amount), 0)
          FROM PaymentAllocation AS previousAllocation
          LEFT JOIN LedgerTransaction AS previousPaymentLedger
            ON previousPaymentLedger.partyId = previousAllocation.partyId
           AND previousPaymentLedger.memberPaymentId = previousAllocation.memberPaymentId
          WHERE previousAllocation.partyId = currentAllocation.partyId
            AND previousAllocation.saleShareId = currentAllocation.saleShareId
            AND (
              previousAllocation.memberPaymentId = NEW.memberPaymentId
              OR previousPaymentLedger.status = 'POSTED'
            )
        ) > (
          SELECT amount FROM SaleShare
          WHERE partyId = currentAllocation.partyId
            AND id = currentAllocation.saleShareId
        )
    )
    THEN RAISE(ABORT, 'PAYOUT_POSTED exceeds outstanding member earnings')
  END;
END;

CREATE TRIGGER IF NOT EXISTS LedgerTransaction_lock_raid
AFTER UPDATE OF status ON LedgerTransaction
WHEN NEW.status = 'POSTED' AND NEW.type = 'SALE_POSTED'
BEGIN
  UPDATE Raid
  SET lockedAt = COALESCE(
    lockedAt,
    NEW.postedAt
  )
  WHERE partyId = NEW.partyId
    AND id = (
      SELECT raidId FROM SaleTransaction
      WHERE partyId = NEW.partyId AND id = NEW.saleTransactionId
    );
END;

CREATE TRIGGER IF NOT EXISTS LedgerTransaction_posted_delete
BEFORE DELETE ON LedgerTransaction
WHEN OLD.status = 'POSTED'
BEGIN
  SELECT RAISE(ABORT, 'Posted LedgerTransaction is immutable');
END;

CREATE TRIGGER IF NOT EXISTS LedgerEntry_source_insert
BEFORE INSERT ON LedgerEntry
WHEN NEW.debit < 0 OR NEW.credit < 0
  OR (NEW.debit = 0 AND NEW.credit = 0)
  OR (NEW.debit > 0 AND NEW.credit > 0)
  OR NEW.accountType NOT IN ('PARTY_CASH', 'MEMBER_PAYABLE')
  OR (NEW.accountType = 'PARTY_CASH' AND NEW.partyMemberId IS NOT NULL)
  OR (NEW.accountType = 'MEMBER_PAYABLE' AND NEW.partyMemberId IS NULL)
  OR COALESCE((
    SELECT status FROM LedgerTransaction
    WHERE partyId = NEW.partyId AND id = NEW.ledgerTransactionId
  ), '') <> 'DRAFT'
BEGIN
  SELECT RAISE(ABORT, 'Invalid LedgerEntry or parent transaction is not DRAFT');
END;

CREATE TRIGGER IF NOT EXISTS LedgerEntry_source_update
BEFORE UPDATE ON LedgerEntry
WHEN NEW.debit < 0 OR NEW.credit < 0
  OR (NEW.debit = 0 AND NEW.credit = 0)
  OR (NEW.debit > 0 AND NEW.credit > 0)
  OR NEW.accountType NOT IN ('PARTY_CASH', 'MEMBER_PAYABLE')
  OR (NEW.accountType = 'PARTY_CASH' AND NEW.partyMemberId IS NOT NULL)
  OR (NEW.accountType = 'MEMBER_PAYABLE' AND NEW.partyMemberId IS NULL)
  OR COALESCE((
    SELECT status FROM LedgerTransaction
    WHERE partyId = OLD.partyId AND id = OLD.ledgerTransactionId
  ), '') <> 'DRAFT'
  OR COALESCE((
    SELECT status FROM LedgerTransaction
    WHERE partyId = NEW.partyId AND id = NEW.ledgerTransactionId
  ), '') <> 'DRAFT'
BEGIN
  SELECT RAISE(ABORT, 'Invalid or immutable LedgerEntry');
END;

CREATE TRIGGER IF NOT EXISTS LedgerEntry_posted_delete
BEFORE DELETE ON LedgerEntry
WHEN COALESCE((
  SELECT status FROM LedgerTransaction
  WHERE partyId = OLD.partyId AND id = OLD.ledgerTransactionId
), '') = 'POSTED'
BEGIN
  SELECT RAISE(ABORT, 'Posted LedgerEntry is immutable');
END;
