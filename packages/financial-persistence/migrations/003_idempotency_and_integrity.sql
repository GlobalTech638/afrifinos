-- Make provider imports safely idempotent and strengthen financial ownership/integrity indexes.

CREATE UNIQUE INDEX IF NOT EXISTS transactions_provider_external_id_uq
  ON transactions(provider_id, external_id)
  WHERE provider_id IS NOT NULL AND external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS transactions_owner_external_idx
  ON transactions(owner_id, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ledger_entries_transaction_account_idx
  ON ledger_entries(transaction_id, account_id);

-- Domain attributes that were not represented in the initial schema.
ALTER TABLE assets ADD COLUMN IF NOT EXISTS asset_type TEXT NOT NULL DEFAULT 'other';
ALTER TABLE assets ADD CONSTRAINT assets_asset_type_ck CHECK (asset_type IN ('cash', 'investment', 'property', 'business', 'other'));

ALTER TABLE liabilities ADD COLUMN IF NOT EXISTS liability_type TEXT NOT NULL DEFAULT 'other';
ALTER TABLE liabilities ADD COLUMN IF NOT EXISTS interest_rate_annual NUMERIC;
ALTER TABLE liabilities ADD CONSTRAINT liabilities_liability_type_ck CHECK (liability_type IN ('loan', 'credit', 'payable', 'other'));

ALTER TABLE obligations ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE obligations ADD CONSTRAINT obligations_status_ck CHECK (status IN ('active', 'settled', 'cancelled'));

ALTER TABLE savings_goals ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE savings_goals ADD CONSTRAINT savings_goals_status_ck CHECK (status IN ('active', 'completed', 'paused', 'cancelled'));

-- A ledger entry must belong to an account owned by the same owner as its transaction.
-- PostgreSQL cannot enforce this with the existing independent foreign keys alone;
-- application-level ownership checks remain mandatory at the write boundary.
