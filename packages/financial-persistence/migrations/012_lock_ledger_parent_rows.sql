-- Close the database-level race between ledger writes and account
-- ownership/currency changes. The ledger trigger must lock the referenced
-- parent rows while validating them: a plain SELECT can observe a compatible
-- snapshot while a concurrent account UPDATE commits incompatible attributes.
CREATE OR REPLACE FUNCTION enforce_ledger_entry_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  transaction_owner TEXT;
  transaction_currency CHAR(3);
  account_owner TEXT;
  account_currency CHAR(3);
BEGIN
  SELECT owner_id, currency
    INTO transaction_owner, transaction_currency
    FROM transactions
    WHERE id = NEW.transaction_id
    FOR SHARE;

  SELECT owner_id, currency
    INTO account_owner, account_currency
    FROM accounts
    WHERE id = NEW.account_id
    FOR SHARE;

  IF transaction_owner IS NULL OR account_owner IS NULL THEN
    RAISE EXCEPTION 'Ledger entry references a missing transaction or account'
      USING ERRCODE = '23503';
  END IF;

  IF transaction_owner <> account_owner THEN
    RAISE EXCEPTION 'Ledger account must belong to the transaction owner'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.currency <> transaction_currency OR NEW.currency <> account_currency THEN
    RAISE EXCEPTION 'Ledger entry currency must match transaction and account currencies'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;
