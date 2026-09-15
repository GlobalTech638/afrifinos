CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE account_type AS ENUM ('mobile_money', 'bank', 'cash', 'sacco', 'investment', 'loan', 'other');
CREATE TYPE account_status AS ENUM ('active', 'archived');
CREATE TYPE transaction_type AS ENUM ('income', 'expense', 'transfer', 'fee', 'refund', 'reversal', 'adjustment');
CREATE TYPE transaction_status AS ENUM ('received', 'validated', 'normalized', 'deduplicated', 'posted', 'enriched', 'reconciled');
CREATE TYPE source_kind AS ENUM ('manual', 'csv', 'provider_api', 'provider_file', 'system');
CREATE TYPE ledger_direction AS ENUM ('debit', 'credit');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type account_type NOT NULL,
  currency CHAR(3) NOT NULL,
  status account_status NOT NULL DEFAULT 'active',
  provider_id UUID REFERENCES providers(id) ON DELETE SET NULL,
  external_account_id TEXT,
  opened_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id)
);

CREATE UNIQUE INDEX accounts_provider_external_id_uq
  ON accounts(provider_id, external_account_id)
  WHERE provider_id IS NOT NULL AND external_account_id IS NOT NULL;
CREATE INDEX accounts_owner_idx ON accounts(owner_id);

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  UNIQUE (owner_id, name)
);

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type transaction_type NOT NULL,
  status transaction_status NOT NULL DEFAULT 'received',
  occurred_at TIMESTAMPTZ NOT NULL,
  description TEXT,
  counterparty TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
  currency CHAR(3) NOT NULL,
  source_kind source_kind NOT NULL,
  provider_id UUID REFERENCES providers(id) ON DELETE SET NULL,
  external_id TEXT,
  source_hash TEXT,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX transactions_provider_external_id_uq
  ON transactions(provider_id, external_id)
  WHERE provider_id IS NOT NULL AND external_id IS NOT NULL;
CREATE INDEX transactions_owner_occurred_idx ON transactions(owner_id, occurred_at DESC);
CREATE INDEX transactions_category_occurred_idx ON transactions(category_id, occurred_at DESC);

CREATE TABLE ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  currency CHAR(3) NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
  direction ledger_direction NOT NULL,
  posted_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (transaction_id, account_id, direction)
);

CREATE INDEX ledger_entries_account_posted_idx ON ledger_entries(account_id, posted_at DESC);
CREATE INDEX ledger_entries_transaction_idx ON ledger_entries(transaction_id);

CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  value_minor BIGINT NOT NULL CHECK (value_minor >= 0),
  currency CHAR(3) NOT NULL,
  as_of TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE liabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  outstanding_minor BIGINT NOT NULL CHECK (outstanding_minor >= 0),
  currency CHAR(3) NOT NULL,
  as_of TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE obligations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
  currency CHAR(3) NOT NULL,
  due_at TIMESTAMPTZ,
  recurring BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE savings_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_minor BIGINT NOT NULL CHECK (target_minor > 0),
  current_minor BIGINT NOT NULL DEFAULT 0 CHECK (current_minor >= 0),
  currency CHAR(3) NOT NULL,
  target_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE provider_balance_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES providers(id) ON DELETE SET NULL,
  observed_balance_minor BIGINT NOT NULL,
  currency CHAR(3) NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX provider_balance_observations_account_time_idx
  ON provider_balance_observations(account_id, observed_at DESC);

CREATE TABLE transaction_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_kind source_kind NOT NULL,
  provider_id UUID REFERENCES providers(id) ON DELETE SET NULL,
  source_name TEXT,
  source_hash TEXT,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  row_count INTEGER NOT NULL DEFAULT 0 CHECK (row_count >= 0)
);

CREATE INDEX transaction_imports_owner_time_idx ON transaction_imports(owner_id, imported_at DESC);
