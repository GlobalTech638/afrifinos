-- Make provider imports safely idempotent and prevent cross-owner ledger writes.

CREATE UNIQUE INDEX IF NOT EXISTS transactions_provider_external_id_uq
  ON transactions(provider_id, external_id)
  WHERE provider_id IS NOT NULL AND external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS transactions_owner_external_idx
  ON transactions(owner_id, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ledger_entries_transaction_account_idx
  ON ledger_entries(transaction_id, account_id);

-- A ledger entry must belong to an account owned by the same owner as its transaction.
-- PostgreSQL cannot enforce this with the existing independent foreign keys alone;
-- application-level ownership checks remain mandatory at the write boundary.
