-- Immutable FX quote snapshots and auditable, two-ledger-leg conversions.
-- Each leg remains balanced in its own currency; the conversion record links them.
CREATE TABLE fx_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  base_currency CHAR(3) NOT NULL CHECK (base_currency ~ '^[A-Z]{3}$'),
  quote_currency CHAR(3) NOT NULL CHECK (quote_currency ~ '^[A-Z]{3}$'),
  base_amount_minor BIGINT NOT NULL CHECK (base_amount_minor > 0),
  quote_amount_minor BIGINT NOT NULL CHECK (quote_amount_minor > 0),
  base_minor_unit_exponent SMALLINT NOT NULL CHECK (base_minor_unit_exponent BETWEEN 0 AND 3),
  quote_minor_unit_exponent SMALLINT NOT NULL CHECK (quote_minor_unit_exponent BETWEEN 0 AND 3),
  -- Rate is quote major units received for one base major unit.
  rate NUMERIC(38, 18) NOT NULL CHECK (rate > 0),
  rate_source TEXT NOT NULL CHECK (length(trim(rate_source)) > 0),
  source_reference TEXT,
  quoted_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (base_currency <> quote_currency),
  CHECK (expires_at > quoted_at),
  CHECK (
    quote_amount_minor = round(
      (base_amount_minor::NUMERIC / power(10::NUMERIC, base_minor_unit_exponent))
      * rate
      * power(10::NUMERIC, quote_minor_unit_exponent)
    )::BIGINT
  )
);

CREATE INDEX fx_quotes_owner_pair_time_idx
  ON fx_quotes(owner_id, base_currency, quote_currency, quoted_at DESC);

CREATE TABLE fx_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  quote_id UUID NOT NULL UNIQUE REFERENCES fx_quotes(id) ON DELETE RESTRICT,
  source_transaction_id UUID NOT NULL UNIQUE REFERENCES transactions(id) ON DELETE RESTRICT,
  destination_transaction_id UUID NOT NULL UNIQUE REFERENCES transactions(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL CHECK (length(trim(idempotency_key)) > 0),
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, idempotency_key),
  CHECK (source_transaction_id <> destination_transaction_id)
);

CREATE INDEX fx_conversions_owner_time_idx
  ON fx_conversions(owner_id, executed_at DESC);

-- Quotes are immutable snapshots: refreshing a quote creates a new row.
CREATE OR REPLACE FUNCTION reject_fx_quote_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'FX quote snapshots are immutable'
    USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER fx_quotes_immutable
  BEFORE UPDATE OR DELETE ON fx_quotes
  FOR EACH ROW EXECUTE FUNCTION reject_fx_quote_mutation();

-- Conversion execution is represented by two independently balanced posted
-- transactions, one per currency. Never force unlike currencies into one ledger.
CREATE OR REPLACE FUNCTION validate_fx_conversion()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  quote_row fx_quotes%ROWTYPE;
  source_row transactions%ROWTYPE;
  destination_row transactions%ROWTYPE;
BEGIN
  SELECT * INTO quote_row
    FROM fx_quotes
    WHERE id = NEW.quote_id
    FOR UPDATE;

  IF NOT FOUND OR quote_row.owner_id <> NEW.owner_id THEN
    RAISE EXCEPTION 'FX quote does not belong to conversion owner'
      USING ERRCODE = '23514';
  END IF;

  IF quote_row.expires_at <= NEW.executed_at THEN
    RAISE EXCEPTION 'FX quote expired before conversion execution'
      USING ERRCODE = '23514';
  END IF;

  SELECT * INTO source_row
    FROM transactions
    WHERE id = NEW.source_transaction_id
    FOR UPDATE;
  SELECT * INTO destination_row
    FROM transactions
    WHERE id = NEW.destination_transaction_id
    FOR UPDATE;

  IF source_row.id IS NULL OR destination_row.id IS NULL THEN
    RAISE EXCEPTION 'FX conversion transactions must exist'
      USING ERRCODE = '23503';
  END IF;

  IF source_row.owner_id <> NEW.owner_id OR destination_row.owner_id <> NEW.owner_id
     OR source_row.status <> 'posted' OR destination_row.status <> 'posted'
     OR source_row.type <> 'transfer' OR destination_row.type <> 'transfer'
     OR source_row.currency <> quote_row.base_currency
     OR destination_row.currency <> quote_row.quote_currency
     OR source_row.amount_minor <> quote_row.base_amount_minor
     OR destination_row.amount_minor <> quote_row.quote_amount_minor THEN
    RAISE EXCEPTION 'FX conversion transactions do not match the owner, transfer type, quote currencies, amounts, or posted status'
      USING ERRCODE = '23514';
  END IF;

  -- A posted status alone is not proof of a valid ledger. Require each
  -- currency leg to satisfy the existing deferred double-entry invariant.
  PERFORM assert_transaction_ledger_balanced(source_row.id);
  PERFORM assert_transaction_ledger_balanced(destination_row.id);

  RETURN NEW;
END;
$$;

CREATE TRIGGER fx_conversions_validate
  BEFORE INSERT ON fx_conversions
  FOR EACH ROW EXECUTE FUNCTION validate_fx_conversion();

CREATE OR REPLACE FUNCTION reject_fx_conversion_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'FX conversion records are immutable'
    USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER fx_conversions_immutable
  BEFORE UPDATE OR DELETE ON fx_conversions
  FOR EACH ROW EXECUTE FUNCTION reject_fx_conversion_mutation();
