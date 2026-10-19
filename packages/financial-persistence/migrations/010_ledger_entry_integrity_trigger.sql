-- Defense in depth: every ledger write must preserve transaction/account
-- tenant isolation and currency consistency, even if a future caller bypasses
-- PostgresFinancialRepository's application-level validation.
CREATE OR REPLACE FUNCTION enforce_ledger_entry_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  transaction_owner UUID;
  transaction_currency CHAR(3);
  account_owner UUID;
  account_currency CHAR(3);
BEGIN
  SELECT owner_id, currency
    INTO transaction_owner, transaction_currency
    FROM transactions
    WHERE id = NEW.transaction_id;

  SELECT owner_id, currency
    INTO account_owner, account_currency
    FROM accounts
    WHERE id = NEW.account_id;

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

DROP TRIGGER IF EXISTS ledger_entry_integrity_before_write ON ledger_entries;
CREATE TRIGGER ledger_entry_integrity_before_write
  BEFORE INSERT OR UPDATE OF transaction_id, account_id, currency
  ON ledger_entries
  FOR EACH ROW
  EXECUTE FUNCTION enforce_ledger_entry_integrity();
