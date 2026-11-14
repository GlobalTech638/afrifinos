-- Permit only the foreign-key cascade when an owner is deleted.
-- Direct deletion and all updates remain prohibited; conversions retain quotes
-- through their ON DELETE RESTRICT relationship.
CREATE OR REPLACE FUNCTION reject_fx_quote_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'FX quote snapshots are immutable'
    USING ERRCODE = '23514';
END;
$$;
