-- Permit the configured owner-deletion cascade for unused FX quote snapshots.
-- Updates remain prohibited; conversions still retain quotes through ON DELETE RESTRICT.
CREATE OR REPLACE FUNCTION reject_fx_quote_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'FX quote snapshots are immutable'
    USING ERRCODE = '23514';
END;
$$;
