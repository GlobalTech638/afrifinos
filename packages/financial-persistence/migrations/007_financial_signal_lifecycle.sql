CREATE TABLE IF NOT EXISTS financial_signals (
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signal_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('cash_flow', 'savings', 'debt', 'net_worth', 'forecast', 'liquidity', 'recurring', 'anomaly', 'health')),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  status TEXT NOT NULL CHECK (status IN ('active', 'acknowledged', 'resolved')),
  title TEXT NOT NULL,
  statement TEXT NOT NULL,
  evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence_ids) = 'array'),
  first_detected_at TIMESTAMPTZ NOT NULL,
  last_detected_at TIMESTAMPTZ NOT NULL,
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, signal_id),
  CHECK (last_detected_at >= first_detected_at),
  CHECK (status <> 'acknowledged' OR acknowledged_at IS NOT NULL),
  CHECK (status <> 'resolved' OR resolved_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS financial_signals_owner_status_updated_idx
  ON financial_signals(owner_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS financial_signals_owner_last_detected_idx
  ON financial_signals(owner_id, last_detected_at DESC);
