-- AfriFINOS domain IDs are opaque strings, not UUID-only values.
-- This migration removes the accidental UUID constraint from application-owned
-- identifiers so values such as "mpesa" and "salary" remain valid persistence IDs.

ALTER TABLE users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE users ALTER COLUMN id TYPE TEXT USING id::text;

ALTER TABLE providers ALTER COLUMN id DROP DEFAULT;
ALTER TABLE providers ALTER COLUMN id TYPE TEXT USING id::text;

ALTER TABLE accounts ALTER COLUMN id DROP DEFAULT;
ALTER TABLE accounts ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE accounts ALTER COLUMN owner_id TYPE TEXT USING owner_id::text;
ALTER TABLE accounts ALTER COLUMN provider_id TYPE TEXT USING provider_id::text;

ALTER TABLE categories ALTER COLUMN id DROP DEFAULT;
ALTER TABLE categories ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE categories ALTER COLUMN owner_id TYPE TEXT USING owner_id::text;
ALTER TABLE categories ALTER COLUMN parent_id TYPE TEXT USING parent_id::text;

ALTER TABLE transactions ALTER COLUMN id DROP DEFAULT;
ALTER TABLE transactions ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE transactions ALTER COLUMN owner_id TYPE TEXT USING owner_id::text;
ALTER TABLE transactions ALTER COLUMN category_id TYPE TEXT USING category_id::text;
ALTER TABLE transactions ALTER COLUMN provider_id TYPE TEXT USING provider_id::text;

ALTER TABLE ledger_entries ALTER COLUMN id DROP DEFAULT;
ALTER TABLE ledger_entries ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE ledger_entries ALTER COLUMN transaction_id TYPE TEXT USING transaction_id::text;
ALTER TABLE ledger_entries ALTER COLUMN account_id TYPE TEXT USING account_id::text;

ALTER TABLE assets ALTER COLUMN id DROP DEFAULT;
ALTER TABLE assets ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE assets ALTER COLUMN owner_id TYPE TEXT USING owner_id::text;

ALTER TABLE liabilities ALTER COLUMN id DROP DEFAULT;
ALTER TABLE liabilities ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE liabilities ALTER COLUMN owner_id TYPE TEXT USING owner_id::text;

ALTER TABLE obligations ALTER COLUMN id DROP DEFAULT;
ALTER TABLE obligations ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE obligations ALTER COLUMN owner_id TYPE TEXT USING owner_id::text;

ALTER TABLE savings_goals ALTER COLUMN id DROP DEFAULT;
ALTER TABLE savings_goals ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE savings_goals ALTER COLUMN owner_id TYPE TEXT USING owner_id::text;

ALTER TABLE provider_balance_observations ALTER COLUMN id DROP DEFAULT;
ALTER TABLE provider_balance_observations ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE provider_balance_observations ALTER COLUMN account_id TYPE TEXT USING account_id::text;
ALTER TABLE provider_balance_observations ALTER COLUMN provider_id TYPE TEXT USING provider_id::text;

ALTER TABLE transaction_imports ALTER COLUMN id DROP DEFAULT;
ALTER TABLE transaction_imports ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE transaction_imports ALTER COLUMN owner_id TYPE TEXT USING owner_id::text;
ALTER TABLE transaction_imports ALTER COLUMN provider_id TYPE TEXT USING provider_id::text;
