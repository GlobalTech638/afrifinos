-- Provider transaction identifiers are unique within an owner's data, not globally.
-- This prevents one tenant's import from suppressing another tenant's transaction.
DROP INDEX IF EXISTS transactions_provider_external_id_uq;

CREATE UNIQUE INDEX transactions_owner_provider_external_id_uq
  ON transactions(owner_id, provider_id, external_id)
  WHERE provider_id IS NOT NULL AND external_id IS NOT NULL;
