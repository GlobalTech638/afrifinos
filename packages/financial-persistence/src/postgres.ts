import type {
  Account, Asset, Liability, LedgerEntry, Obligation, SavingsGoal, Transaction,
} from "@afrifinos/financial-domain";
import type { FinancialRepository, TransactionWriteRepository, TransactionWriteResult, FinancialSignalInput, StoredFinancialSignal, PersistedSignalStatus } from "./index.js";

export interface SqlQueryResult<Row extends Record<string, unknown> = Record<string, unknown>> { readonly rows: readonly Row[]; }
export interface SqlClient {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<SqlQueryResult<Row>>;
  transaction<T>(work: (client: SqlClient) => Promise<T>): Promise<T>;
}
interface AccountRow extends Record<string, unknown> { id: string; owner_id: string; name: string; type: Account["type"]; currency: string; status: Account["status"]; provider_id: string | null; external_account_id: string | null; opened_at: string | null; archived_at: string | null; }
interface TransactionRow extends Record<string, unknown> { id: string; owner_id: string; type: Transaction["type"]; status: Transaction["status"]; occurred_at: string; description: string | null; counterparty: string | null; category_id: string | null; amount_minor: string | number; currency: string; source_kind: Transaction["provenance"]["sourceKind"]; provider_id: string | null; external_id: string | null; imported_at: string; source_hash: string | null; }
interface LedgerRow extends Record<string, unknown> { id: string; transaction_id: string; account_id: string; currency: string; amount_minor: string | number; direction: LedgerEntry["direction"]; posted_at: string; }

function requiredCurrency(value: string): Transaction["total"]["currency"] { if (!/^[A-Z]{3}$/.test(value)) throw new Error(`Invalid currency returned by database: ${value}`); return value as Transaction["total"]["currency"]; }
function accountFromRow(row: AccountRow): Account { return { accountId: row.id, ownerId: row.owner_id, name: row.name, type: row.type, currency: requiredCurrency(row.currency), status: row.status, ...(row.provider_id ? { providerId: row.provider_id } : {}), ...(row.external_account_id ? { externalAccountId: row.external_account_id } : {}), ...(row.opened_at ? { openedAt: row.opened_at } : {}), ...(row.archived_at ? { archivedAt: row.archived_at } : {}) }; }
function transactionFromRow(row: TransactionRow): Transaction { return { transactionId: row.id, ownerId: row.owner_id, type: row.type, status: row.status, occurredAt: row.occurred_at, ...(row.description ? { description: row.description } : {}), ...(row.counterparty ? { counterparty: row.counterparty } : {}), ...(row.category_id ? { categoryId: row.category_id } : {}), total: { amountMinor: BigInt(row.amount_minor), currency: requiredCurrency(row.currency) }, provenance: { sourceKind: row.source_kind, ...(row.provider_id ? { providerId: row.provider_id } : {}), ...(row.external_id ? { externalId: row.external_id } : {}), importedAt: row.imported_at, ...(row.source_hash ? { sourceHash: row.source_hash } : {}) } }; }
function ledgerFromRow(row: LedgerRow): LedgerEntry { return { entryId: row.id, transactionId: row.transaction_id, accountId: row.account_id, currency: requiredCurrency(row.currency), amountMinor: BigInt(row.amount_minor), direction: row.direction, postedAt: row.posted_at }; }
function optionalRange(from?: string, to?: string): { clause: string; values: string[] } { const values: string[] = []; const clauses: string[] = []; if (from) { values.push(from); clauses.push(`occurred_at >= $${values.length}`); } if (to) { values.push(to); clauses.push(`occurred_at < $${values.length}`); } return { clause: clauses.length ? ` AND ${clauses.join(" AND ")}` : "", values }; }

export class PostgresFinancialRepository implements FinancialRepository, TransactionWriteRepository {
  public constructor(private readonly client: SqlClient) {}
  async ensureOwner(ownerId: string): Promise<void> { if (!ownerId.trim()) throw new Error("ownerId cannot be empty"); await this.client.query("INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING", [ownerId]); }
  async getAccounts(ownerId: string): Promise<readonly Account[]> { const result = await this.client.query<AccountRow>(`SELECT id, owner_id, name, type, currency, status, provider_id, external_account_id, opened_at, archived_at FROM accounts WHERE owner_id = $1 ORDER BY created_at ASC`, [ownerId]); return result.rows.map(accountFromRow); }
  async saveAccount(account: Account): Promise<void> { await this.ensureOwner(account.ownerId); await this.client.query(`INSERT INTO accounts (id, owner_id, name, type, currency, status, provider_id, external_account_id, opened_at, archived_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, [account.accountId, account.ownerId, account.name, account.type, account.currency, account.status, account.providerId ?? null, account.externalAccountId ?? null, account.openedAt ?? null, account.archivedAt ?? null]); }
  async assertAccountsOwnedBy(ownerId: string, accountIds: readonly string[]): Promise<void> { const ids = [...new Set(accountIds)]; if (!ids.length) throw new Error("At least one account is required"); const placeholders = ids.map((_, index) => "$" + (index + 2)).join(", "); const result = await this.client.query<{ count: string | number }>(`SELECT COUNT(*)::int AS count FROM accounts WHERE owner_id = $1 AND id IN (${placeholders})`, [ownerId, ...ids]); if (Number(result.rows[0]?.count ?? 0) !== ids.length) throw new Error("One or more accounts do not belong to the authenticated owner"); }
  async assertAccountsCurrency(ownerId: string, accountIds: readonly string[], currency: string): Promise<void> { const ids = [...new Set(accountIds)]; if (!ids.length) throw new Error("At least one account is required"); const result = await this.client.query<{ count: string | number; matching_count: string | number }>(`SELECT COUNT(*)::int AS count, COUNT(*) FILTER (WHERE currency = $2)::int AS matching_count FROM accounts WHERE owner_id = $1 AND id::text = ANY($3::text[])`, [ownerId, currency, ids]); if (Number(result.rows[0]?.count ?? 0) !== ids.length) throw new Error("One or more accounts do not belong to the authenticated owner"); if (Number(result.rows[0]?.matching_count ?? 0) !== ids.length) throw new Error("Transaction currency must match both account currencies"); }
  async getTransactionByProviderExternalId(ownerId: string, providerId: string, externalId: string): Promise<Transaction | null> { const result = await this.client.query<TransactionRow>(`SELECT id, owner_id, type, status, occurred_at, description, counterparty, category_id, amount_minor, currency, source_kind, provider_id, external_id, imported_at, source_hash FROM transactions WHERE owner_id = $1 AND provider_id = $2 AND external_id = $3 LIMIT 1`, [ownerId, providerId, externalId]); return result.rows[0] ? transactionFromRow(result.rows[0]) : null; }
  async saveTransaction(transaction: Transaction): Promise<void> { await this.client.query(`INSERT INTO transactions (id, owner_id, type, status, occurred_at, description, counterparty, category_id, amount_minor, currency, source_kind, provider_id, external_id, imported_at, source_hash) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) ON CONFLICT (id) DO NOTHING`, [transaction.transactionId, transaction.ownerId, transaction.type, transaction.status, transaction.occurredAt, transaction.description ?? null, transaction.counterparty ?? null, transaction.categoryId ?? null, transaction.total.amountMinor.toString(), transaction.total.currency, transaction.provenance.sourceKind, transaction.provenance.providerId ?? null, transaction.provenance.externalId ?? null, transaction.provenance.importedAt, transaction.provenance.sourceHash ?? null]); }
  private async insertLedgerEntries(client: SqlClient, entries: readonly LedgerEntry[]): Promise<void> { for (const entry of entries) { const ownership = await client.query<{ transaction_owner_id: string; transaction_currency: string; account_owner_id: string; account_currency: string }>(`SELECT t.owner_id AS transaction_owner_id, t.currency AS transaction_currency, a.owner_id AS account_owner_id, a.currency AS account_currency FROM transactions t JOIN accounts a ON a.id = $2 WHERE t.id = $1 FOR SHARE OF t, a`, [entry.transactionId, entry.accountId]); const row = ownership.rows[0]; if (!row || row.transaction_owner_id !== row.account_owner_id) throw new Error("Ledger account must belong to the transaction owner"); if (row.transaction_currency !== entry.currency || row.account_currency !== entry.currency) throw new Error("Ledger entry currency must match both transaction and account currencies"); const result = await client.query<{ id: string }>(`INSERT INTO ledger_entries (id, transaction_id, account_id, currency, amount_minor, direction, posted_at) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id WHERE ledger_entries.transaction_id = EXCLUDED.transaction_id AND ledger_entries.account_id = EXCLUDED.account_id AND ledger_entries.currency = EXCLUDED.currency AND ledger_entries.amount_minor = EXCLUDED.amount_minor AND ledger_entries.direction = EXCLUDED.direction AND ledger_entries.posted_at = EXCLUDED.posted_at RETURNING id`, [entry.entryId, entry.transactionId, entry.accountId, entry.currency, entry.amountMinor.toString(), entry.direction, entry.postedAt]); if (!result.rows.length) throw new Error(`Ledger entry id conflict with different data: ${entry.entryId}`); } }
  async saveLedgerEntries(entries: readonly LedgerEntry[]): Promise<void> {
    if (!entries.length) return;
    const grouped = new Map<string, LedgerEntry[]>();
    for (const entry of entries) {
      if (entry.amountMinor < 0n) throw new Error("Ledger entries must use non-negative amounts");
      const group = grouped.get(entry.transactionId) ?? [];
      group.push(entry);
      grouped.set(entry.transactionId, group);
    }
    for (const [transactionId, group] of grouped) {
      if (new Set(group.map((entry) => entry.currency)).size !== 1) throw new Error("Ledger entries for a transaction must use one currency");
      if (new Set(group.map((entry) => entry.accountId)).size < 2) throw new Error("A transaction requires ledger entries for at least two distinct accounts");
      const debitTotal = group.filter((entry) => entry.direction === "debit").reduce((sum, entry) => sum + entry.amountMinor, 0n);
      const creditTotal = group.filter((entry) => entry.direction === "credit").reduce((sum, entry) => sum + entry.amountMinor, 0n);
      if (debitTotal <= 0n || debitTotal !== creditTotal) throw new Error("Ledger entries must have equal positive debit and credit totals");
    }
    await this.client.transaction(async (tx) => {
      for (const [transactionId, group] of grouped) {
        const transaction = await tx.query<{ amount_minor: string | number; currency: string }>(`SELECT amount_minor, currency FROM transactions WHERE id = $1 FOR SHARE`, [transactionId]);
        const row = transaction.rows[0];
        if (!row) throw new Error("Ledger transaction does not exist");
        if (String(row.currency) !== group[0]?.currency) throw new Error("Ledger entry currency must match transaction currency");
        const debitTotal = group.filter((entry) => entry.direction === "debit").reduce((sum, entry) => sum + entry.amountMinor, 0n);
        if (debitTotal !== BigInt(row.amount_minor)) throw new Error("Ledger total must match the transaction amount");
      }
      await this.insertLedgerEntries(tx, entries);
    });
  }
  async saveTransactionWithLedger(transaction: Transaction, entries: readonly LedgerEntry[]): Promise<TransactionWriteResult> { if (transaction.provenance.providerId !== undefined && !transaction.provenance.providerId.trim()) throw new Error("Provider identifier cannot be empty"); if (transaction.provenance.externalId !== undefined && !transaction.provenance.externalId.trim()) throw new Error("External transaction identifier cannot be empty"); const accountIds = [...new Set(entries.map((entry) => entry.accountId))]; if (!entries.length || entries.some((entry) => entry.transactionId !== transaction.transactionId || entry.currency !== transaction.total.currency || entry.amountMinor < 0n)) throw new Error("Ledger entries must match their transaction identity and currency and use non-negative amounts"); const debitTotal = entries.filter((entry) => entry.direction === "debit").reduce((sum, entry) => sum + entry.amountMinor, 0n); const creditTotal = entries.filter((entry) => entry.direction === "credit").reduce((sum, entry) => sum + entry.amountMinor, 0n); if (debitTotal <= 0n || debitTotal !== creditTotal) throw new Error("Ledger entries must have equal positive debit and credit totals"); if (debitTotal !== transaction.total.amountMinor) throw new Error("Ledger total must match the transaction amount"); if (accountIds.length < 2) throw new Error("A transaction requires ledger entries for at least two distinct accounts"); return this.client.transaction(async (tx) => { const ownership = await tx.query<{ id: string; currency: string }>(`SELECT id::text AS id, currency FROM accounts WHERE owner_id = $1 AND id::text = ANY($2::text[]) FOR SHARE`, [transaction.ownerId, accountIds]); if (ownership.rows.length !== accountIds.length) throw new Error("Ledger accounts must belong to the transaction owner"); if (ownership.rows.some((account) => account.currency !== transaction.total.currency)) throw new Error("Ledger account currency must match transaction currency"); const result = await tx.query<{ id: string }>(`INSERT INTO transactions (id, owner_id, type, status, occurred_at, description, counterparty, category_id, amount_minor, currency, source_kind, provider_id, external_id, imported_at, source_hash) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) ON CONFLICT (owner_id, provider_id, external_id) WHERE provider_id IS NOT NULL AND external_id IS NOT NULL DO NOTHING RETURNING id`, [transaction.transactionId, transaction.ownerId, transaction.type, transaction.status, transaction.occurredAt, transaction.description ?? null, transaction.counterparty ?? null, transaction.categoryId ?? null, transaction.total.amountMinor.toString(), transaction.total.currency, transaction.provenance.sourceKind, transaction.provenance.providerId ?? null, transaction.provenance.externalId ?? null, transaction.provenance.importedAt, transaction.provenance.sourceHash ?? null]); if (!result.rows.length) {
      // A provider identifier is an idempotency key, not proof that the payload
      // is unchanged. Do not silently discard a changed amount/date/counterparty
      // when two imports race or a provider reuses an identifier.
      if (transaction.provenance.providerId && transaction.provenance.externalId) {
        const existing = await tx.query<{
          type: Transaction["type"];
          status: Transaction["status"];
          occurred_at: string;
          description: string | null;
          counterparty: string | null;
          category_id: string | null;
          amount_minor: string | number;
          currency: string;
          source_kind: Transaction["provenance"]["sourceKind"];
        }>(`SELECT type, status, occurred_at, description, counterparty, category_id,
          amount_minor, currency, source_kind
          FROM transactions
          WHERE owner_id = $1 AND provider_id = $2 AND external_id = $3
          FOR SHARE`, [transaction.ownerId, transaction.provenance.providerId, transaction.provenance.externalId]);
        const row = existing.rows[0];
        const samePayload = row !== undefined
          && row.type === transaction.type
          && row.status === transaction.status
          && Date.parse(String(row.occurred_at)) === Date.parse(transaction.occurredAt)
          && row.description === (transaction.description ?? null)
          && row.counterparty === (transaction.counterparty ?? null)
          && row.category_id === (transaction.categoryId ?? null)
          && BigInt(row.amount_minor) === transaction.total.amountMinor
          && row.currency === transaction.total.currency
          && row.source_kind === transaction.provenance.sourceKind;
        if (!samePayload) {
          throw new Error("Provider transaction identifier conflicts with a different payload");
        }
      }
      return "duplicate";
    }
    await this.insertLedgerEntries(tx, entries);
    return "inserted"; }); }
  async getTransactions(ownerId: string, from?: string, to?: string): Promise<readonly Transaction[]> { const range = optionalRange(from, to); const result = await this.client.query<TransactionRow>(`SELECT id, owner_id, type, status, occurred_at, description, counterparty, category_id, amount_minor, currency, source_kind, provider_id, external_id, imported_at, source_hash FROM transactions WHERE owner_id = $1${range.clause} ORDER BY occurred_at ASC`, [ownerId, ...range.values]); return result.rows.map(transactionFromRow); }
  async getLedgerEntries(ownerId: string, accountIds: readonly string[], from?: string, to?: string): Promise<readonly LedgerEntry[]> { if (!ownerId.trim()) throw new Error("ownerId cannot be empty"); if (!accountIds.length) return []; const placeholders = accountIds.map((_, index) => `${index + 2}`).join(", "); const values: string[] = [ownerId, ...accountIds]; const clauses = [`a.owner_id = $1`, `le.account_id::text IN (${placeholders})`]; if (from) { values.push(from); clauses.push(`le.posted_at >= ${values.length}`); } if (to) { values.push(to); clauses.push(`le.posted_at < ${values.length}`); } const result = await this.client.query<LedgerRow>(`SELECT le.id, le.transaction_id, le.account_id, le.currency, le.amount_minor, le.direction, le.posted_at FROM ledger_entries le INNER JOIN accounts a ON a.id = le.account_id WHERE ${clauses.join(" AND ")} ORDER BY le.posted_at ASC`, values); return result.rows.map(ledgerFromRow); }
  async getAssets(ownerId: string): Promise<readonly Asset[]> { const result = await this.client.query<Record<string, unknown>>(`SELECT id, owner_id, name, value_minor, currency, as_of, asset_type FROM assets WHERE owner_id = $1 ORDER BY as_of DESC`, [ownerId]); return result.rows.map((row) => ({ assetId: String(row.id), ownerId: String(row.owner_id), name: String(row.name), value: { amountMinor: BigInt(String(row.value_minor)), currency: requiredCurrency(String(row.currency)) }, assetType: String(row.asset_type) as Asset["assetType"], valuedAt: String(row.as_of) })); }
  async getLiabilities(ownerId: string): Promise<readonly Liability[]> { const result = await this.client.query<Record<string, unknown>>(`SELECT id, owner_id, name, outstanding_minor, currency, as_of, liability_type, interest_rate_annual FROM liabilities WHERE owner_id = $1 ORDER BY as_of DESC`, [ownerId]); return result.rows.map((row) => ({ liabilityId: String(row.id), ownerId: String(row.owner_id), name: String(row.name), outstanding: { amountMinor: BigInt(String(row.outstanding_minor)), currency: requiredCurrency(String(row.currency)) }, liabilityType: String(row.liability_type) as Liability["liabilityType"], ...(row.interest_rate_annual !== null && row.interest_rate_annual !== undefined ? { interestRateAnnual: Number(row.interest_rate_annual) } : {}) })); }
  async getObligations(ownerId: string): Promise<readonly Obligation[]> { const result = await this.client.query<Record<string, unknown>>(`SELECT id, owner_id, name, amount_minor, currency, due_at, status, recurring, recurrence, kind, liability_id FROM obligations WHERE owner_id = $1 ORDER BY due_at ASC NULLS LAST`, [ownerId]); return result.rows.map((row) => ({ obligationId: String(row.id), ownerId: String(row.owner_id), name: String(row.name), amount: { amountMinor: BigInt(String(row.amount_minor)), currency: requiredCurrency(String(row.currency)) }, ...(row.due_at ? { dueAt: String(row.due_at) } : {}), status: String(row.status) as Obligation["status"], recurring: Boolean(row.recurring), ...(row.recurrence ? { recurrence: String(row.recurrence) as NonNullable<Obligation["recurrence"]> } : {}), ...(row.kind ? { kind: String(row.kind) as NonNullable<Obligation["kind"]> } : {}), ...(row.liability_id ? { liabilityId: String(row.liability_id) } : {}) })); }
  async getSavingsGoals(ownerId: string): Promise<readonly SavingsGoal[]> { const result = await this.client.query<Record<string, unknown>>(`SELECT id, owner_id, name, target_minor, current_minor, currency, target_date, status FROM savings_goals WHERE owner_id = $1 ORDER BY target_date ASC NULLS LAST`, [ownerId]); return result.rows.map((row) => ({ goalId: String(row.id), ownerId: String(row.owner_id), name: String(row.name), target: { amountMinor: BigInt(String(row.target_minor)), currency: requiredCurrency(String(row.currency)) }, current: { amountMinor: BigInt(String(row.current_minor)), currency: requiredCurrency(String(row.currency)) }, ...(row.target_date ? { targetAt: String(row.target_date) } : {}), status: String(row.status) as SavingsGoal["status"] })); }
  private signalFromRow(row: Record<string, unknown>): StoredFinancialSignal {
    const rawEvidence = row.evidence_ids;
    const evidenceIds = Array.isArray(rawEvidence) ? rawEvidence.map(String) : typeof rawEvidence === "string" ? JSON.parse(rawEvidence) as string[] : [];
    return {
      ownerId: String(row.owner_id), signalId: String(row.signal_id), category: String(row.category),
      severity: String(row.severity) as StoredFinancialSignal["severity"],
      status: String(row.status) as PersistedSignalStatus, title: String(row.title), statement: String(row.statement),
      evidenceIds, firstDetectedAt: new Date(String(row.first_detected_at)).toISOString(),
      lastDetectedAt: new Date(String(row.last_detected_at)).toISOString(),
      ...(row.acknowledged_at ? { acknowledgedAt: new Date(String(row.acknowledged_at)).toISOString() } : {}),
      ...(row.resolved_at ? { resolvedAt: new Date(String(row.resolved_at)).toISOString() } : {}),
    };
  }
  async reconcileFinancialSignals(ownerId: string, signals: readonly FinancialSignalInput[], reconciledAt?: string): Promise<readonly StoredFinancialSignal[]> {
    if (!ownerId.trim()) {
      throw new Error("Financial signal ownerId cannot be empty");
    }
    const signalIds = new Set<string>();
    for (const signal of signals) {
      if (!signal.id.trim()) {
        throw new Error("Financial signal id cannot be empty");
      }
      if (signalIds.has(signal.id)) {
        throw new Error(`Duplicate financial signal id: ${signal.id}`);
      }
      signalIds.add(signal.id);
    }
    const timestampValues = [reconciledAt, ...signals.map((signal) => signal.detectedAt)]
      .filter((value): value is string => value !== undefined);
    for (const timestamp of timestampValues) {
      if (!Number.isFinite(Date.parse(timestamp))) {
        throw new Error("Financial signal timestamps must be valid ISO-compatible timestamps");
      }
    }
    const snapshotAt = reconciledAt ?? signals.reduce<string | undefined>(
      (latest, signal) => !latest || Date.parse(signal.detectedAt) > Date.parse(latest)
        ? signal.detectedAt
        : latest,
      undefined,
    ) ?? new Date().toISOString();
    return this.client.transaction(async (tx) => {
      // Serialize snapshot reconciliation per owner, then reject snapshots older than
      // the latest committed reconciliation. A lock alone cannot prevent stale work
      // that started earlier from committing after a newer snapshot.
      await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [ownerId]);
      const watermark = await tx.query<{ owner_id: string }>(`INSERT INTO financial_signal_reconciliations (owner_id, reconciled_at)
        VALUES ($1, $2)
        ON CONFLICT (owner_id) DO UPDATE SET reconciled_at = EXCLUDED.reconciled_at
        WHERE financial_signal_reconciliations.reconciled_at < EXCLUDED.reconciled_at
        RETURNING owner_id`, [ownerId, snapshotAt]);
      if (!watermark.rows.length) {
        const current = await tx.query<Record<string, unknown>>(
          "SELECT * FROM financial_signals WHERE owner_id = $1 ORDER BY last_detected_at DESC",
          [ownerId],
        );
        return current.rows.map((row) => this.signalFromRow(row));
      }
      for (const signal of signals) {
        await tx.query(`INSERT INTO financial_signals
          (owner_id, signal_id, category, severity, status, title, statement, evidence_ids, first_detected_at, last_detected_at, updated_at)
          VALUES ($1, $2, $3, $4, 'active', $5, $6, $7::jsonb, $8, $8, now())
          ON CONFLICT (owner_id, signal_id) DO UPDATE SET
            category = EXCLUDED.category, severity = EXCLUDED.severity, title = EXCLUDED.title,
            statement = EXCLUDED.statement, evidence_ids = EXCLUDED.evidence_ids,
            first_detected_at = CASE WHEN financial_signals.status = 'resolved' THEN EXCLUDED.first_detected_at ELSE financial_signals.first_detected_at END,
            status = CASE WHEN financial_signals.status = 'acknowledged' THEN 'acknowledged' ELSE 'active' END,
            last_detected_at = EXCLUDED.last_detected_at,
            acknowledged_at = CASE WHEN financial_signals.status = 'acknowledged' THEN financial_signals.acknowledged_at ELSE NULL END,
            resolved_at = NULL, updated_at = now()`,
          [ownerId, signal.id, signal.category, signal.severity, signal.title, signal.statement, JSON.stringify(signal.evidenceIds), signal.detectedAt]);
      }
      const ids = signals.map((signal) => signal.id);
      await tx.query(`UPDATE financial_signals SET status = 'resolved', resolved_at = now(), updated_at = now()
        WHERE owner_id = $1 AND status IN ('active', 'acknowledged') AND NOT (signal_id = ANY($2::text[]))`, [ownerId, ids]);
      const result = await tx.query<Record<string, unknown>>(`SELECT * FROM financial_signals WHERE owner_id = $1 ORDER BY last_detected_at DESC`, [ownerId]);
      return result.rows.map((row) => this.signalFromRow(row));
    });
  }
  async acknowledgeFinancialSignal(ownerId: string, signalId: string): Promise<StoredFinancialSignal | null> {
    if (!ownerId.trim()) {
      throw new Error("Financial signal ownerId cannot be empty");
    }
    if (!signalId.trim()) {
      throw new Error("Financial signal id cannot be empty");
    }
    return this.client.transaction(async (tx) => {
      // Share the reconciliation lock so acknowledgement cannot race a snapshot refresh.
      await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [ownerId]);
      const result = await tx.query<Record<string, unknown>>(`UPDATE financial_signals
        SET status = 'acknowledged', acknowledged_at = COALESCE(acknowledged_at, now()), updated_at = now()
        WHERE owner_id = $1 AND signal_id = $2 AND status IN ('active', 'acknowledged')
        RETURNING *`, [ownerId, signalId]);
      return result.rows[0] ? this.signalFromRow(result.rows[0]) : null;
    });
  }
  async getFinancialSignals(ownerId: string, status?: PersistedSignalStatus): Promise<readonly StoredFinancialSignal[]> {
    const result = await this.client.query<Record<string, unknown>>(`SELECT * FROM financial_signals
      WHERE owner_id = $1 AND ($2::text IS NULL OR status = $2)
      ORDER BY last_detected_at DESC`, [ownerId, status ?? null]);
    return result.rows.map((row) => this.signalFromRow(row));
  }
}
