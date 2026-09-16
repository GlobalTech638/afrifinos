-- Make obligation semantics explicit so recurring commitments are not implicitly treated as debt.

ALTER TABLE obligations
  ADD COLUMN IF NOT EXISTS kind TEXT
    CHECK (kind IN ('debt_service', 'rent', 'utility', 'subscription', 'education', 'insurance', 'tax', 'goal_contribution', 'other'));

ALTER TABLE obligations
  ADD COLUMN IF NOT EXISTS liability_id TEXT REFERENCES liabilities(id) ON DELETE SET NULL;

-- Preserve the historical debt-service behavior for existing recurring obligations while
-- making the classification explicit for all future calculations.
UPDATE obligations
SET kind = CASE WHEN recurring THEN 'debt_service' ELSE 'other' END
WHERE kind IS NULL;

ALTER TABLE obligations
  ALTER COLUMN kind SET NOT NULL;

CREATE INDEX IF NOT EXISTS obligations_owner_kind_idx
  ON obligations(owner_id, kind);

CREATE INDEX IF NOT EXISTS obligations_owner_liability_idx
  ON obligations(owner_id, liability_id)
  WHERE liability_id IS NOT NULL;
