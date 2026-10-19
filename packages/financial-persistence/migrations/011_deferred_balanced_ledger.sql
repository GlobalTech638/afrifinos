-- Enforce balanced double-entry postings at transaction commit. A deferred
-- constraint trigger allows a balanced set of rows to be inserted one at a
-- time inside a transaction, but rejects incomplete or unbalanced final state.
CREATE OR REPLACE FUNCTION assert_transaction_ledger_balanced(p_transaction_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  expected_amount BIGINT;
  expected_currency CHAR(3);
  entry_count BIGINT;
  distinct_account_count BIGINT;
  debit_total NUMERIC;
  credit_total NUMERIC;
BEGIN
  SELECT amount_minor, currency
    INTO expected_amount, expected_currency
    FROM transactions
    WHERE id = p_transaction_id;

  -- The transaction may have been removed in a larger, valid lifecycle change.
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT COUNT(*),
         COUNT(DISTINCT account_id),
         COALESCE(SUM(CASE WHEN direction = 'debit' THEN amount_minor ELSE 0 END), 0),
         COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount_minor ELSE 0 END), 0)
    INTO entry_count, distinct_account_count, debit_total, credit_total
    FROM ledger_entries
    WHERE transaction_id = p_transaction_id;

  IF entry_count < 2 OR distinct_account_count < 2 THEN
    RAISE EXCEPTION 'A transaction requires ledger entries for at least two distinct accounts'
      USING ERRCODE = '23514';
  END IF;

  IF debit_total <= 0 OR debit_total <> credit_total THEN
    RAISE EXCEPTION 'Ledger entries must have equal positive debit and credit totals'
      USING ERRCODE = '23514';
  END IF;

  IF debit_total <> expected_amount THEN
    RAISE EXCEPTION 'Ledger total must match the transaction amount'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM ledger_entries
      WHERE transaction_id = p_transaction_id
        AND currency <> expected_currency
  ) THEN
    RAISE EXCEPTION 'Ledger entry currency must match transaction currency'
      USING ERRCODE = '23514';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_balanced_ledger_at_commit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.transaction_id IS DISTINCT FROM NEW.transaction_id THEN
    PERFORM assert_transaction_ledger_balanced(OLD.transaction_id);
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM assert_transaction_ledger_balanced(OLD.transaction_id);
  ELSE
    PERFORM assert_transaction_ledger_balanced(NEW.transaction_id);
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS ledger_entries_balanced_at_commit ON ledger_entries;
CREATE CONSTRAINT TRIGGER ledger_entries_balanced_at_commit
  AFTER INSERT OR UPDATE OR DELETE ON ledger_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION enforce_balanced_ledger_at_commit();
