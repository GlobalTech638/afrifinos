CREATE TABLE IF NOT EXISTS financial_signals (
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signal_id TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  status TEXT NOT NULL CHECK (status IN ('active', 'acknowledged', 'resolved')),
  title TEXT NOT NULL,
  statement TEXT NOT NULL,
  evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  first_detected_at TIMESTAMPTZ NOT NULL,
  last_detected_at TIMESTAMPTZ NOT NULL,
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, signal_id)
);

CREATE INDEX IF NOT EXISTS financial_signals_owner_status_updated_idx
  ON financial_signals(owner_id, status, updated_at DESC);
