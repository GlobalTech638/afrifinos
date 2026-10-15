CREATE TABLE IF NOT EXISTS financial_signal_reconciliations (
  owner_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  reconciled_at TIMESTAMPTZ NOT NULL
);
