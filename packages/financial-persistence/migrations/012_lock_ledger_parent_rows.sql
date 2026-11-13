-- Close the database-level race between ledger writes and account
-- ownership/currency changes. The ledger trigger must lock the referenced
-- parent rows while validating them: a plain SELECT can observe a compatible
-- snapshot while a concurrent account UPDATE commits incompatible attributes.
CREATE OR REPLACE FUNCTION enforce_ledger_entry_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  account_owner TEXT;
  account_currency CHAR(3);
BEGIN
  SELECT owner_id, currency
    INTO account_owner, account_currency
    FROM accounts
    WHERE id = NEW.account_id
    FOR SHARE;

  IF account_owner IS NULL THEN
    RAISE EXCEPTION 'Ledger entry references a missing account'
      USING ERRCODE = '23503';
  END IF;

  -- The existing deferred constraint trigger validates transaction ownership
  -- and currency against the final transaction row at commit. Avoid taking a
  -- transaction SHARE lock here: the ledger-serialization trigger takes an
  -- UPDATE lock, and SHARE-before-UPDATE across concurrent inserts can deadlock.
  -- Locking the account is sufficient to serialize against account mutations.

  RETURN NEW;
END;
$$;
