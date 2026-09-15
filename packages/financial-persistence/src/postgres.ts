import type {
  Account,
  Asset,
  Liability,
  LedgerEntry,
  Obligation,
  SavingsGoal,
  Transaction,
} from "@afrifinos/financial-domain";
import type { FinancialRepository, TransactionWriteRepository } from "./index.js";

export interface SqlQueryResult<Row extends Record<string, unknown> = Record<string, unknown>> {
  readonly rows: readonly Row[];
}

export interface SqlClient {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<SqlQueryResult<Row>>;
  transaction<T>(work: (client: SqlClient) => Promise<T>): Promise<T>;
}

interface AccountRow extends Record<string, unknown> {
  id: string;
  owner_id: string;
  name: string;
  type: Account["type"];
  currency: string;
  status: Account["status"];
  provider_id: string | null;
  external_account_id: string | null;
  opened_at: string | null;
  archived_at: string | null;
}

interface TransactionRow extends Record<string, unknown> {
  id: string;
  owner_id: string;
  type: Transaction["type"];
  status: Transaction["status"];
  occurred_at: string;
  description: string | null;
  counterparty: string | null;
  category_id: string | null;
  amount_minor: string | number;
  currency: string;
  source_kind: Transaction["provenance"]["sourceKind"];
  provider_id: string | null;
  external_id: string | null;
  imported_at: string;
  source_hash: string | null;
}

interface LedgerRow extends Record<string, unknown> {
  id: string;
  transaction_id: string;
  account_id: string;
  currency: string;
  amount_minor: string | number;
  direction: LedgerEntry["direction"];
  posted_at: string;
}

function requiredCurrency(value: string): Transaction["total"]["currency"] {
  if (value.length !== 3) throw new Error(`Invalid currency returned by database: ${value}`);
  return value as Transaction["total"]["currency"];
}

function accountFromRow(row: AccountRow): Account {
  return {
    accountId: row.id,
    ownerId: row.owner_id,
    name: row.name,
    type: row.type,
    currency: requiredCurrency(row.currency),
    status: row.status,
    ...(row.provider_id ? { providerId: row.provider_id } : {}),
    ...(row.external_account_id ? { externalAccountId: row.external_account_id } : {}),
    ...(row.opened_at ? { openedAt: row.opened_at } : {}),
    ...(row.archived_at ? { archivedAt: row.archived_at } : {}),
  };
}

function transactionFromRow(row: TransactionRow): Transaction {
  return {
    transactionId: row.id,
    ownerId: row.owner_id,
    type: row.type,
    status: row.status,
    occurredAt: row.occurred_at,
    ...(row.description ? { description: row.description } : {}),
    ...(row.counterparty ? { counterparty: row.counterparty } : {}),
    ...(row.category_id ? { categoryId: row.category_id } : {}),
    total: { amountMinor: BigInt(row.amount_minor), currency: requiredCurrency(row.currency) },
    provenance: {
      sourceKind: row.source_kind,
      ...(row.provider_id ? { providerId: row.provider_id } : {}),
      ...(row.external_id ? { externalId: row.external_id } : {}),
      importedAt: row.imported_at,
      ...(row.source_hash ? { sourceHash: row.source_hash } : {}),
    },
  };
}

function ledgerFromRow(row: LedgerRow): LedgerEntry {
  return {
    entryId: row.id,
    transactionId: row.transaction_id,
    accountId: row.account_id,
    currency: requiredCurrency(row.currency),
    amountMinor: BigInt(row.amount_minor),
    direction: row.direction,
    postedAt: row.posted_at,
  };
}

function optionalRange(from?: string, to?: string): { clause: string; values: string[] } {
  const values: string[] = [];
  const clauses: string[] = [];
  if (from) {
    values.push(from);
    clauses.push(`occurred_at >= $${values.length}`);
  }
  if (to) {
    values.push(to);
    clauses.push(`occurred_at < $${values.length}`);
  }
  return { clause: clauses.length ? ` AND ${clauses.join(" AND ")}` : "", values };
}

export class PostgresFinancialRepository implements FinancialRepository, TransactionWriteRepository {
  public constructor(private readonly client: SqlClient) {}

  async getAccounts(ownerId: string): Promise<readonly Account[]> {
    const result = await this.client.query<AccountRow>(
      `SELECT id, owner_id, name, type, currency, status, provider_id, external_account_id, opened_at, archived_at
       FROM accounts WHERE owner_id = $1 ORDER BY created_at ASC`,
      [ownerId],
    );
    return result.rows.map(accountFromRow);
  }

  async assertAccountsOwnedBy(ownerId: string, accountIds: readonly string[]): Promise<void> {
    const uniqueAccountIds = [...new Set(accountIds)];
    if (uniqueAccountIds.length === 0) throw new Error("At least one account is required");

    const placeholders = uniqueAccountIds.map((_, index) => `$${index + 2}`).join(", ");
    const result = await this.client.query<{ count: string | number }>(
      `SELECT COUNT(*)::int AS count
       FROM accounts
       WHERE owner_id = $1 AND id IN (${placeholders})`,
      [ownerId, ...uniqueAccountIds],
    );

    const count = Number(result.rows[0]?.count ?? 0);
    if (count !== uniqueAccountIds.length) {
      throw new Error("One or more accounts do not belong to the authenticated owner");
    }
  }

  async saveTransaction(transaction: Transaction): Promise<void> {
    await this.client.query(
      `INSERT INTO transactions
       (id, owner_id, type, status, occurred_at, description, counterparty, category_id,
        amount_minor, currency, source_kind, provider_id, external_id, imported_at, source_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       ON CONFLICT (id) DO NOTHING`,
      [
        transaction.transactionId,
        transaction.ownerId,
        transaction.type,
        transaction.status,
        transaction.occurredAt,
        transaction.description ?? null,
        transaction.counterparty ?? null,
        transaction.categoryId ?? null,
        transaction.total.amountMinor.toString(),
        transaction.total.currency,
        transaction.provenance.sourceKind,
        transaction.provenance.providerId ?? null,
        transaction.provenance.externalId ?? null,
        transaction.provenance.importedAt,
        transaction.provenance.sourceHash ?? null,
      ],
    );
  }

  async saveLedgerEntries(entries: readonly LedgerEntry[]): Promise<void> {
    for (const entry of entries) {
      await this.client.query(
        `INSERT INTO ledger_entries
         (id, transaction_id, account_id, currency, amount_minor, direction, posted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [entry.entryId, entry.transactionId, entry.accountId, entry.currency, entry.amountMinor.toString(), entry.direction, entry.postedAt],
      );
    }
  }

  async saveTransactionWithLedger(transaction: Transaction, entries: readonly LedgerEntry[]): Promise<void> {
    await this.client.transaction(async (tx) => {
      await new PostgresFinancialRepository(tx).saveTransaction(transaction);
      await new PostgresFinancialRepository(tx).saveLedgerEntries(entries);
    });
  }

  async getTransactions(ownerId: string, from?: string, to?: string): Promise<readonly Transaction[]> {
    const range = optionalRange(from, to);
    const result = await this.client.query<TransactionRow>(
      `SELECT id, owner_id, type, status, occurred_at, description, counterparty, category_id,
              amount_minor, currency, source_kind, provider_id, external_id, imported_at, source_hash
       FROM transactions WHERE owner_id = $1${range.clause} ORDER BY occurred_at ASC`,
      [ownerId, ...range.values],
    );
    return result.rows.map(transactionFromRow);
  }

  async getLedgerEntries(accountIds: readonly string[], from?: string, to?: string): Promise<readonly LedgerEntry[]> {
    if (accountIds.length === 0) return [];
    const placeholders = accountIds.map((_, index) => `$${index + 1}`).join(", ");
    const values: string[] = [...accountIds];
    const clauses = [`account_id IN (${placeholders})`];
    if (from) { values.push(from); clauses.push(`posted_at >= $${values.length}`); }
    if (to) { values.push(to); clauses.push(`posted_at < $${values.length}`); }
    const result = await this.client.query<LedgerRow>(
      `SELECT id, transaction_id, account_id, currency, amount_minor, direction, posted_at
       FROM ledger_entries WHERE ${clauses.join(" AND ")} ORDER BY posted_at ASC`,
      values,
    );
    return result.rows.map(ledgerFromRow);
  }

  async getAssets(ownerId: string): Promise<readonly Asset[]> {
    const result = await this.client.query<Record<string, unknown>>(
      `SELECT id, owner_id, name, value_minor, currency, as_of FROM assets WHERE owner_id = $1 ORDER BY as_of DESC`,
      [ownerId],
    );
    return result.rows.map((row) => ({
      assetId: String(row.id), ownerId: String(row.owner_id), name: String(row.name),
      value: { amountMinor: BigInt(String(row.value_minor)), currency: requiredCurrency(String(row.currency)) },
      asOf: String(row.as_of),
    }));
  }

  async getLiabilities(ownerId: string): Promise<readonly Liability[]> {
    const result = await this.client.query<Record<string, unknown>>(
      `SELECT id, owner_id, name, outstanding_minor, currency, as_of FROM liabilities WHERE owner_id = $1 ORDER BY as_of DESC`,
      [ownerId],
    );
    return result.rows.map((row) => ({
      liabilityId: String(row.id), ownerId: String(row.owner_id), name: String(row.name),
      outstanding: { amountMinor: BigInt(String(row.outstanding_minor)), currency: requiredCurrency(String(row.currency)) },
      asOf: String(row.as_of),
    }));
  }

  async getObligations(ownerId: string): Promise<readonly Obligation[]> {
    const result = await this.client.query<Record<string, unknown>>(
      `SELECT id, owner_id, name, amount_minor, currency, due_at, recurring FROM obligations WHERE owner_id = $1 ORDER BY due_at ASC NULLS LAST`,
      [ownerId],
    );
    return result.rows.map((row) => ({
      obligationId: String(row.id), ownerId: String(row.owner_id), name: String(row.name),
      amount: { amountMinor: BigInt(String(row.amount_minor)), currency: requiredCurrency(String(row.currency)) },
      ...(row.due_at ? { dueAt: String(row.due_at) } : {}), recurring: Boolean(row.recurring),
    }));
  }

  async getSavingsGoals(ownerId: string): Promise<readonly SavingsGoal[]> {
    const result = await this.client.query<Record<string, unknown>>(
      `SELECT id, owner_id, name, target_minor, current_minor, currency, target_date FROM savings_goals WHERE owner_id = $1 ORDER BY target_date ASC NULLS LAST`,
      [ownerId],
    );
    return result.rows.map((row) => ({
      goalId: String(row.id), ownerId: String(row.owner_id), name: String(row.name),
      target: { amountMinor: BigInt(String(row.target_minor)), currency: requiredCurrency(String(row.currency)) },
      current: { amountMinor: BigInt(String(row.current_minor)), currency: requiredCurrency(String(row.currency)) },
      ...(row.target_date ? { targetDate: String(row.target_date) } : {}),
    }));
  }
}
