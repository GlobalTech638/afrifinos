ALTER TABLE obligations
  ADD COLUMN IF NOT EXISTS recurrence TEXT
    CHECK (recurrence IN ('once', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annual'));

UPDATE obligations
SET recurrence = CASE WHEN recurring THEN 'monthly' ELSE 'once' END
WHERE recurrence IS NULL;

ALTER TABLE obligations
  ALTER COLUMN recurrence SET NOT NULL;

CREATE INDEX IF NOT EXISTS obligations_owner_due_idx
  ON obligations(owner_id, due_at);
