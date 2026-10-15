CREATE TABLE IF NOT EXISTS financial_signal_reconciliations (
  owner_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  reconciled_at TIMESTAMPTZ NOT NULL
);
