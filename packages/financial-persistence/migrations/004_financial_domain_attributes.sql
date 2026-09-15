-- Persist domain attributes that were absent from the initial financial schema.

ALTER TABLE assets ADD COLUMN IF NOT EXISTS asset_type TEXT NOT NULL DEFAULT 'other';
ALTER TABLE assets ADD CONSTRAINT assets_asset_type_ck CHECK (asset_type IN ('cash', 'investment', 'property', 'business', 'other'));

ALTER TABLE liabilities ADD COLUMN IF NOT EXISTS liability_type TEXT NOT NULL DEFAULT 'other';
ALTER TABLE liabilities ADD COLUMN IF NOT EXISTS interest_rate_annual NUMERIC;
ALTER TABLE liabilities ADD CONSTRAINT liabilities_liability_type_ck CHECK (liability_type IN ('loan', 'credit', 'payable', 'other'));

ALTER TABLE obligations ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE obligations ADD CONSTRAINT obligations_status_ck CHECK (status IN ('active', 'settled', 'cancelled'));

ALTER TABLE savings_goals ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE savings_goals ADD CONSTRAINT savings_goals_status_ck CHECK (status IN ('active', 'completed', 'paused', 'cancelled'));
