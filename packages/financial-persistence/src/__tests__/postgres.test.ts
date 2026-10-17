import { describe, expect, it } from "vitest";
import { PostgresFinancialRepository, type SqlClient } from "../postgres.js";
import type { Transaction, LedgerEntry } from "@afrifinos/financial-domain";

function createClient(existingWatermark?: string, failSignalInsert = false, conflictingLedgerEntryId?: string, ownedAccountCount?: number, matchingCurrencyCount?: number, ledgerOwnership = { transactionOwnerId: "user-1", accountOwnerId: "user-1", transactionCurrency: "KES", accountCurrency: "KES" }): SqlClient & { queries: Array<{ text: string; values: readonly unknown[] }> } {
  let watermark = existingWatermark;
  const client = {
    queries: [] as Array<{ text: string; values: readonly unknown[] }>,
    async query<Row extends Record<string, unknown> = Record<string, unknown>>(text: string, values: readonly unknown[] = []) {
      client.queries.push({ text, values });
      if (failSignalInsert && text.includes("INSERT INTO financial_signals")) {
        throw new Error("simulated signal row write failure");
      }
      let rows: Row[] = [];
      if (text.includes("SELECT amount_minor, currency FROM transactions")) {
        rows = [{ amount_minor: "2500", currency: "KES" } as unknown as Row];
      }
      if (text.includes("JOIN accounts a") && text.includes("FOR SHARE OF t, a")) {
        rows = [{
          transaction_owner_id: ledgerOwnership.transactionOwnerId,
          transaction_currency: ledgerOwnership.transactionCurrency,
          account_owner_id: ledgerOwnership.accountOwnerId,
          account_currency: ledgerOwnership.accountCurrency,
        } as unknown as Row];
      }
      if (text.includes("FROM accounts") && text.includes("FOR SHARE")) {
        const accountIds = Array.isArray(values[1]) ? values[1] as string[] : [];
        const ownedCount = Math.min(ownedAccountCount ?? accountIds.length, accountIds.length);
        const currencyCount = Math.min(matchingCurrencyCount ?? ownedCount, ownedCount);
        rows = accountIds.slice(0, ownedCount).map((id, index) => ({
          id,
          currency: index < currencyCount ? String(values[2] ?? "KES") : "USD",
        } as unknown as Row));
      }
      if (text.includes("INSERT INTO transactions")) {
        rows = [{ id: String(values[0]) } as unknown as Row];
      }
      if (text.includes("INSERT INTO ledger_entries")) {
        rows = values[0] === conflictingLedgerEntryId ? [] : [{ id: String(values[0]) } as unknown as Row];
      }
      if (text.includes("INSERT INTO financial_signal_reconciliations")) {
        const incoming = String(values[1]);
        if (watermark === undefined || Date.parse(incoming) > Date.parse(watermark)) {
          watermark = incoming;
          rows = [{ owner_id: String(values[0]) } as unknown as Row];
        }
      }
      return { rows };
    },
    async transaction<T>(work: (tx: SqlClient) => Promise<T>): Promise<T> {
      try {
        return await work(client);
      } catch (error) {
        throw error;
      }
    },
  };
  return client;
}

const transaction: Transaction = {
  transactionId: "txn-1",
  ownerId: "user-1",
  type: "expense",
  status: "posted",
  occurredAt: "2026-09-15T10:00:00Z",
  description: "Groceries",
  total: { amountMinor: 2500n, currency: "KES" as Transaction["total"]["currency"] },
  provenance: { sourceKind: "manual", importedAt: "2026-09-15T10:01:00Z" },
};

const entries: readonly LedgerEntry[] = [
  { entryId: "txn-1:primary", transactionId: "txn-1", accountId: "cash", currency: "KES" as LedgerEntry["currency"], amountMinor: 2500n, direction: "debit", postedAt: transaction.occurredAt },
  { entryId: "txn-1:counter", transactionId: "txn-1", accountId: "expense", currency: "KES" as LedgerEntry["currency"], amountMinor: 2500n, direction: "credit", postedAt: transaction.occurredAt },
];

describe("PostgresFinancialRepository", () => {
  it("uses bound parameters when verifying account ownership", async () => {
    const client = createClient();
    const repository = new PostgresFinancialRepository(client);

    await expect(repository.assertAccountsOwnedBy("user-1", ["cash", "expense"]))
      .rejects.toThrow("One or more accounts do not belong to the authenticated owner");

    expect(client.queries[0]?.text).toContain("id IN ($2, $3)");
    expect(client.queries[0]?.values).toEqual(["user-1", "cash", "expense"]);
  });

  it("propagates signal row failures and skips subsequent reconciliation writes", async () => {
    let transactionRejected = false;
    const baseClient = createClient(undefined, true);
    const client = {
      ...baseClient,
      queries: baseClient.queries,
      async query<Row extends Record<string, unknown> = Record<string, unknown>>(text: string, values: readonly unknown[] = []) {
        return baseClient.query<Row>(text, values);
      },
      async transaction<T>(work: (tx: SqlClient) => Promise<T>): Promise<T> {
        try {
          return await work(this as unknown as SqlClient);
        } catch (error) {
          transactionRejected = true;
          throw error;
        }
      },
    };
    const repository = new PostgresFinancialRepository(client);

    await expect(repository.reconcileFinancialSignals("user-11", [{
      id: "write-failure",
      category: "forecast",
      severity: "warning",
      status: "active",
      title: "Write failure",
      statement: "This reconciliation must stop after the failed write.",
      evidenceIds: [],
      detectedAt: "2026-09-19T10:00:00.000Z",
    }])).rejects.toThrow("simulated signal row write failure");

    expect(transactionRejected).toBe(true);
    expect(client.queries.some((query) => query.text.includes("INSERT INTO financial_signal_reconciliations"))).toBe(true);
    expect(client.queries.some((query) => query.text.includes("SET status = 'resolved'"))).toBe(false);
    expect(client.queries.some((query) => query.text.includes("SELECT * FROM financial_signals"))).toBe(false);
  });

  it("rejects unbalanced standalone ledger batches before writing", async () => {
    const client = createClient();
    const repository = new PostgresFinancialRepository(client);

    const unbalanced = [
      entries[0]!,
      { ...entries[1]!, amountMinor: entries[1]!.amountMinor - 1n },
    ];
    await expect(repository.saveLedgerEntries(unbalanced))
      .rejects.toThrow("Ledger entries must have equal positive debit and credit totals");

    expect(client.queries).toHaveLength(0);
  });

  it("rejects standalone ledger batches that reuse one account for both sides", async () => {
    const client = createClient();
    const repository = new PostgresFinancialRepository(client);
    const sameAccount = [
      entries[0]!,
      { ...entries[1]!, accountId: entries[0]!.accountId },
    ];

    await expect(repository.saveLedgerEntries(sameAccount))
      .rejects.toThrow("A transaction requires ledger entries for at least two distinct accounts");

    expect(client.queries).toHaveLength(0);
  });

  it("rejects direct ledger writes across owners", async () => {
    const client = createClient(undefined, false, undefined, undefined, undefined, {
      transactionOwnerId: "user-1",
      accountOwnerId: "user-2",
      transactionCurrency: "KES",
      accountCurrency: "KES",
    });
    const repository = new PostgresFinancialRepository(client);

    await expect(repository.saveLedgerEntries(entries))
      .rejects.toThrow("Ledger account must belong to the transaction owner");

    expect(client.queries).toHaveLength(2);
    expect(client.queries[0]?.text).toContain("SELECT amount_minor, currency FROM transactions");
    expect(client.queries[1]?.text).toContain("JOIN accounts a");
  });

  it("rejects direct ledger writes with a mismatched currency", async () => {
    const client = createClient(undefined, false, undefined, undefined, undefined, {
      transactionOwnerId: "user-1",
      accountOwnerId: "user-1",
      transactionCurrency: "KES",
      accountCurrency: "USD",
    });
    const repository = new PostgresFinancialRepository(client);

    await expect(repository.saveLedgerEntries(entries))
      .rejects.toThrow("Ledger entry currency must match both transaction and account currencies");

    expect(client.queries).toHaveLength(2);
    expect(client.queries[0]?.text).toContain("SELECT amount_minor, currency FROM transactions");
    expect(client.queries[1]?.text).toContain("JOIN accounts a");
  });

  it("validates and writes standalone ledger entries inside one transaction", async () => {
    const base = createClient();
    let transactionCalls = 0;
    const client: SqlClient & { queries: Array<{ text: string; values: readonly unknown[] }> } = {
      queries: base.queries,
      async query<Row extends Record<string, unknown> = Record<string, unknown>>(text: string, values: readonly unknown[] = []) {
        return base.query<Row>(text, values);
      },
      async transaction<T>(work: (tx: SqlClient) => Promise<T>): Promise<T> {
        transactionCalls += 1;
        return work(this);
      },
    };
    const repository = new PostgresFinancialRepository(client);

    await repository.saveLedgerEntries(entries);

    expect(transactionCalls).toBe(1);
    expect(client.queries.map((query) =>
      query.text.includes("SELECT amount_minor, currency FROM transactions") ? "transaction-validation" :
      query.text.includes("JOIN accounts a") ? "entry-ownership" :
      query.text.includes("INSERT INTO ledger_entries") ? "ledger-write" : "unexpected",
    )).toEqual([
      "transaction-validation",
      "entry-ownership",
      "ledger-write",
      "entry-ownership",
      "ledger-write",
    ]);
  });

  it("persists transaction and ledger entries in one transaction", async () => {
    const client = createClient();
    const repository = new PostgresFinancialRepository(client);

    await repository.saveTransactionWithLedger(transaction, entries);

    expect(client.queries).toHaveLength(6);
    expect(client.queries[0]?.text).toContain("FROM accounts");
    expect(client.queries[1]?.text).toContain("INSERT INTO transactions");
    expect(client.queries[1]?.text).toContain("ON CONFLICT (owner_id, provider_id, external_id) WHERE provider_id IS NOT NULL AND external_id IS NOT NULL DO NOTHING");
    expect(client.queries[2]?.text).toContain("JOIN accounts a");
    expect(client.queries[3]?.text).toContain("INSERT INTO ledger_entries");
    expect(client.queries[4]?.text).toContain("JOIN accounts a");
    expect(client.queries[5]?.text).toContain("INSERT INTO ledger_entries");
    expect(client.queries[1]?.values[8]).toBe("2500");
  });

  it("treats a matching provider payload as a duplicate without reposting its ledger", async () => {
    const base = createClient();
    const client: SqlClient & { queries: Array<{ text: string; values: readonly unknown[] }> } = {
      queries: base.queries,
      async query<Row extends Record<string, unknown> = Record<string, unknown>>(text: string, values: readonly unknown[] = []) {
        if (text.includes("INSERT INTO transactions")) {
          base.queries.push({ text, values });
          return { rows: [] };
        }
        if (text.includes("FROM transactions") && text.includes("WHERE owner_id = $1 AND provider_id = $2 AND external_id = $3")) {
          base.queries.push({ text, values });
          return { rows: [{
            type: transaction.type,
            status: transaction.status,
            occurred_at: transaction.occurredAt,
            description: transaction.description ?? null,
            counterparty: transaction.counterparty ?? null,
            category_id: transaction.categoryId ?? null,
            amount_minor: "2500",
            currency: "KES",
            source_kind: transaction.provenance.sourceKind,
          } as unknown as Row] };
        }
        return base.query<Row>(text, values);
      },
      async transaction<T>(work: (tx: SqlClient) => Promise<T>): Promise<T> {
        return work(this);
      },
    };
    const providerTransaction: Transaction = {
      ...transaction,
      provenance: { sourceKind: "bank_import", providerId: "bank-a", externalId: "ext-1", importedAt: transaction.provenance.importedAt },
    };
    const repository = new PostgresFinancialRepository(client);

    await expect(repository.saveTransactionWithLedger(providerTransaction, entries)).resolves.toBe("duplicate");
    expect(client.queries.some((query) => query.text.includes("INSERT INTO ledger_entries"))).toBe(false);
    expect(client.queries.some((query) => query.text.includes("FOR SHARE") && query.text.includes("WHERE owner_id = $1 AND provider_id = $2"))).toBe(true);
  });

  it("rejects a provider identifier reused for a different transaction payload", async () => {
    const base = createClient();
    const client: SqlClient & { queries: Array<{ text: string; values: readonly unknown[] }> } = {
      queries: base.queries,
      async query<Row extends Record<string, unknown> = Record<string, unknown>>(text: string, values: readonly unknown[] = []) {
        if (text.includes("INSERT INTO transactions")) {
          base.queries.push({ text, values });
          return { rows: [] };
        }
        if (text.includes("FROM transactions") && text.includes("WHERE owner_id = $1 AND provider_id = $2 AND external_id = $3")) {
          base.queries.push({ text, values });
          return { rows: [{
            type: transaction.type,
            status: transaction.status,
            occurred_at: transaction.occurredAt,
            description: "Different transaction description",
            counterparty: transaction.counterparty ?? null,
            category_id: transaction.categoryId ?? null,
            amount_minor: "2500",
            currency: "KES",
            source_kind: "bank_import",
          } as unknown as Row] };
        }
        return base.query<Row>(text, values);
      },
      async transaction<T>(work: (tx: SqlClient) => Promise<T>): Promise<T> {
        return work(this);
      },
    };
    const providerTransaction: Transaction = {
      ...transaction,
      provenance: { sourceKind: "bank_import", providerId: "bank-a", externalId: "ext-1", importedAt: transaction.provenance.importedAt },
    };
    const repository = new PostgresFinancialRepository(client);

    await expect(repository.saveTransactionWithLedger(providerTransaction, entries))
      .rejects.toThrow("Provider transaction identifier conflicts with a different payload");
    expect(client.queries.some((query) => query.text.includes("INSERT INTO ledger_entries"))).toBe(false);
  });

  it("rejects balanced ledger entries that disagree with the transaction amount", async () => {
    const client = createClient();
    const repository = new PostgresFinancialRepository(client);
    const balancedButWrong = [
      { ...entries[0]!, amountMinor: 2400n },
      { ...entries[1]!, amountMinor: 2400n },
    ];

    await expect(repository.saveTransactionWithLedger(transaction, balancedButWrong))
      .rejects.toThrow("Ledger total must match the transaction amount");

    expect(client.queries).toHaveLength(0);
  });

  it("rejects negative ledger amounts before issuing persistence queries", async () => {
    const client = createClient();
    const repository = new PostgresFinancialRepository(client);
    const negative = [{ ...entries[0]!, amountMinor: -1n }, entries[1]!];

    await expect(repository.saveTransactionWithLedger(transaction, negative))
      .rejects.toThrow("Ledger entries must match their transaction identity and currency and use non-negative amounts");

    expect(client.queries).toHaveLength(0);
  });

  it("rejects an unbalanced ledger before issuing persistence queries", async () => {
    const client = createClient();
    const repository = new PostgresFinancialRepository(client);
    const unbalanced = [entries[0]!, { ...entries[1]!, amountMinor: 2400n }];

    await expect(repository.saveTransactionWithLedger(transaction, unbalanced))
      .rejects.toThrow("Ledger entries must have equal positive debit and credit totals");

    expect(client.queries).toHaveLength(0);
  });

  it("rejects ledger writes when accounts are not all owned by the transaction owner", async () => {
    const client = createClient(undefined, false, undefined, 1, 1);
    const repository = new PostgresFinancialRepository(client);

    await expect(repository.saveTransactionWithLedger(transaction, entries))
      .rejects.toThrow("Ledger accounts must belong to the transaction owner");

    expect(client.queries).toHaveLength(1);
    expect(client.queries[0]?.text).toContain("FOR SHARE");
  });

  it("rejects ledger writes when an account currency differs from the transaction currency", async () => {
    const client = createClient(undefined, false, undefined, 2, 1);
    const repository = new PostgresFinancialRepository(client);

    await expect(repository.saveTransactionWithLedger(transaction, entries))
      .rejects.toThrow("Ledger account currency must match transaction currency");

    expect(client.queries).toHaveLength(1);
    expect(client.queries[0]?.text).toContain("FOR SHARE");
  });

  it("writes a transaction and its ledger entries using a single transaction boundary", async () => {
    const base = createClient();
    let transactionCalls = 0;
    const client: SqlClient & { queries: Array<{ text: string; values: readonly unknown[] }> } = {
      queries: base.queries,
      async query<Row extends Record<string, unknown> = Record<string, unknown>>(text: string, values: readonly unknown[] = []) {
        return base.query<Row>(text, values);
      },
      async transaction<T>(work: (tx: SqlClient) => Promise<T>): Promise<T> {
        transactionCalls += 1;
        return work(this);
      },
    };
    const repository = new PostgresFinancialRepository(client);

    await repository.saveTransactionWithLedger(transaction, entries);

    expect(transactionCalls).toBe(1);
    expect(client.queries.map((query) => query.text.includes("JOIN accounts a") ? "entry-ownership" : query.text.includes("FROM accounts") ? "batch-ownership" : query.text.includes("INSERT INTO transactions") ? "transaction" : "ledger"))
      .toEqual(["batch-ownership", "transaction", "entry-ownership", "ledger", "entry-ownership", "ledger"]);
  });

  it("rejects reuse of a ledger entry id when the existing row has different data", async () => {
    const client = createClient(undefined, false, entries[0]!.entryId);
    const repository = new PostgresFinancialRepository(client);

    await expect(repository.saveTransactionWithLedger(transaction, entries))
      .rejects.toThrow(`Ledger entry id conflict with different data: ${entries[0]!.entryId}`);

    expect(client.queries).toHaveLength(4);
    expect(client.queries[0]?.text).toContain("FROM accounts");
    expect(client.queries[1]?.text).toContain("INSERT INTO transactions");
    expect(client.queries[2]?.text).toContain("JOIN accounts a");
    expect(client.queries[3]?.text).toContain("WHERE ledger_entries.transaction_id = EXCLUDED.transaction_id");
    expect(client.queries[3]?.text).toContain("RETURNING id");
  });


  it("reconciles signal lifecycle within an owner-scoped transaction", async () => {
    const client = createClient();
    const repository = new PostgresFinancialRepository(client);
    await repository.reconcileFinancialSignals("user-1", [{
      id: "liquidity-critical", category: "forecast", severity: "critical", status: "active",
      title: "Critical liquidity risk", statement: "Projected liquidity reaches the safety threshold.",
      evidenceIds: ["forecast.liquidityRisk"], detectedAt: "2026-09-15T10:00:00.000Z",
    }]);
    expect(client.queries).toHaveLength(5);
    expect(client.queries[0]?.text).toContain("pg_advisory_xact_lock");
    expect(client.queries[1]?.text).toContain("INSERT INTO financial_signal_reconciliations");
    expect(client.queries[1]?.values).toEqual(["user-1", "2026-09-15T10:00:00.000Z"]);
    expect(client.queries[2]?.text).toContain("INSERT INTO financial_signals");
    expect(client.queries[2]?.text).toContain("ON CONFLICT (owner_id, signal_id)");
    expect(client.queries[2]?.text).toContain("financial_signals.status = 'resolved'");
    expect(client.queries[2]?.values[0]).toBe("user-1");
    expect(client.queries[2]?.values[6]).toBe(JSON.stringify(["forecast.liquidityRisk"]));
    expect(client.queries[3]?.text).toContain("status IN ('active', 'acknowledged')");
    expect(client.queries[3]?.values).toEqual(["user-1", ["liquidity-critical"]]);
    expect(client.queries[4]?.text).toContain("SELECT * FROM financial_signals WHERE owner_id = $1");
  });

  it("preserves acknowledgement and resets a resolved signal when it reappears", async () => {
    const client = createClient();
    const repository = new PostgresFinancialRepository(client);

    await repository.reconcileFinancialSignals("user-5", [{
      id: "liquidity-critical",
      category: "forecast",
      severity: "critical",
      status: "active",
      title: "Critical liquidity risk",
      statement: "Projected liquidity is below the safety threshold.",
      evidenceIds: ["forecast.liquidityRisk"],
      detectedAt: "2026-09-16T10:00:00.000Z",
    }], "2026-09-16T10:00:00.000Z");

    const upsert = client.queries.find((query) => query.text.includes("INSERT INTO financial_signals"));
    expect(upsert).toBeDefined();
    expect(upsert?.text).toContain("first_detected_at = CASE WHEN financial_signals.status = 'resolved' THEN EXCLUDED.first_detected_at ELSE financial_signals.first_detected_at END");
    expect(upsert?.text).toContain("status = CASE WHEN financial_signals.status = 'acknowledged' THEN 'acknowledged' ELSE 'active' END");
    expect(upsert?.text).toContain("acknowledged_at = CASE WHEN financial_signals.status = 'acknowledged' THEN financial_signals.acknowledged_at ELSE NULL END");
    expect(upsert?.text).toContain("resolved_at = NULL");
    expect(upsert?.values[7]).toBe("2026-09-16T10:00:00.000Z");
  });

  it("resolves missing signals while retaining owner-scoped history", async () => {
    const client = createClient();
    const repository = new PostgresFinancialRepository(client);
    await repository.reconcileFinancialSignals("user-3", []);
    expect(client.queries).toHaveLength(4);
    expect(client.queries[0]?.text).toContain("pg_advisory_xact_lock");
    expect(client.queries[1]?.text).toContain("INSERT INTO financial_signal_reconciliations");
    expect(client.queries[2]?.text).toContain("SET status = 'resolved'");
    expect(client.queries[2]?.values).toEqual(["user-3", []]);
    expect(client.queries[3]?.text).toContain("SELECT * FROM financial_signals WHERE owner_id = $1");
    expect(client.queries[3]?.values).toEqual(["user-3"]);
  });

  it("rejects a reconciliation with the same watermark timestamp", async () => {
    const client = createClient("2026-09-17T10:00:00.000Z");
    const repository = new PostgresFinancialRepository(client);

    await expect(repository.reconcileFinancialSignals("user-6", [], "2026-09-17T10:00:00.000Z")).resolves.toEqual([]);

    expect(client.queries).toHaveLength(3);
    expect(client.queries[1]?.text).toContain("WHERE financial_signal_reconciliations.reconciled_at < EXCLUDED.reconciled_at");
    expect(client.queries[2]?.text).toContain("SELECT * FROM financial_signals WHERE owner_id = $1");
    expect(client.queries.some((query) => query.text.includes("SET status = 'resolved'"))).toBe(false);
  });

  it("rejects duplicate signal identifiers before writing reconciliation state", async () => {
    const client = createClient();
    const repository = new PostgresFinancialRepository(client);
    const duplicate = {
      id: "duplicate",
      category: "forecast",
      severity: "warning" as const,
      status: "active" as const,
      title: "Duplicate signal",
      statement: "Signal identifiers must be unique within a snapshot.",
      evidenceIds: [],
      detectedAt: "2026-09-18T10:00:00.000Z",
    };

    await expect(repository.reconcileFinancialSignals("user-10", [duplicate, duplicate]))
      .rejects.toThrow("Duplicate financial signal id: duplicate");

    expect(client.queries).toHaveLength(0);
    expect(client.queries.some((query) => query.text.includes("INSERT INTO financial_signal_reconciliations"))).toBe(false);
    expect(client.queries.some((query) => query.text.includes("INSERT INTO financial_signals"))).toBe(false);
  });

  it("rejects an empty owner identifier before taking a reconciliation lock", async () => {
    const client = createClient();
    const repository = new PostgresFinancialRepository(client);

    await expect(repository.reconcileFinancialSignals("  ", []))
      .rejects.toThrow("Financial signal ownerId cannot be empty");

    expect(client.queries).toHaveLength(0);
  });

  it("rejects invalid signal detection timestamps before writing signal rows", async () => {
    const client = createClient();
    const repository = new PostgresFinancialRepository(client);

    await expect(repository.reconcileFinancialSignals("user-9", [{
      id: "bad-time",
      category: "forecast",
      severity: "warning",
      status: "active",
      title: "Invalid timestamp",
      statement: "Timestamp should be rejected.",
      evidenceIds: [],
      detectedAt: "not-a-timestamp",
    }])).rejects.toThrow("Financial signal timestamps must be valid ISO-compatible timestamps");

    expect(client.queries).toHaveLength(0);
    expect(client.queries.some((query) => query.text.includes("INSERT INTO financial_signal_reconciliations"))).toBe(false);
    expect(client.queries.some((query) => query.text.includes("INSERT INTO financial_signals"))).toBe(false);
  });

  it("rejects invalid reconciliation timestamps before issuing watermark SQL", async () => {
    const client = createClient();
    const repository = new PostgresFinancialRepository(client);

    await expect(repository.reconcileFinancialSignals("user-8", [], "not-a-timestamp"))
      .rejects.toThrow("Financial signal timestamps must be valid ISO-compatible timestamps");

    expect(client.queries).toHaveLength(0);
    expect(client.queries.some((query) => query.text.includes("INSERT INTO financial_signal_reconciliations"))).toBe(false);
  });

  it("compares watermark timestamps as instants across timezone offsets", async () => {
    const client = createClient("2026-09-17T13:00:00.000+03:00");
    const repository = new PostgresFinancialRepository(client);

    await expect(repository.reconcileFinancialSignals(
      "user-7",
      [],
      "2026-09-17T10:00:00.000Z",
    )).resolves.toEqual([]);

    expect(client.queries).toHaveLength(3);
    expect(client.queries[2]?.text).toContain("SELECT * FROM financial_signals WHERE owner_id = $1");
    expect(client.queries.some((query) => query.text.includes("SET status = 'resolved'"))).toBe(false);
  });

  it("does not apply a stale snapshot after a newer reconciliation", async () => {
    const client = createClient("2026-09-15T10:00:00.000Z");
    const repository = new PostgresFinancialRepository(client);
    await expect(repository.reconcileFinancialSignals("user-4", [{
      id: "old-signal", category: "forecast", severity: "warning", status: "active",
      title: "Old snapshot", statement: "This snapshot is stale.", evidenceIds: [],
      detectedAt: "2026-09-14T10:00:00.000Z",
    }], "2026-09-14T10:00:00.000Z")).resolves.toEqual([]);
    expect(client.queries).toHaveLength(3);
    expect(client.queries[1]?.text).toContain("WHERE financial_signal_reconciliations.reconciled_at < EXCLUDED.reconciled_at");
    expect(client.queries[2]?.text).toContain("SELECT * FROM financial_signals WHERE owner_id = $1");
    expect(client.queries.some((query) => query.text.includes("INSERT INTO financial_signals"))).toBe(false);
    expect(client.queries.some((query) => query.text.includes("SET status = 'resolved'"))).toBe(false);
  });

  it("rejects empty acknowledgement identifiers before opening a transaction", async () => {
    const client = createClient();
    const repository = new PostgresFinancialRepository(client);

    await expect(repository.acknowledgeFinancialSignal("  ", "signal-1"))
      .rejects.toThrow("Financial signal ownerId cannot be empty");
    await expect(repository.acknowledgeFinancialSignal("user-1", "  "))
      .rejects.toThrow("Financial signal id cannot be empty");

    expect(client.queries).toHaveLength(0);
  });

  it("acknowledges a signal only within the specified owner's scope", async () => {
    const client = createClient();
    const repository = new PostgresFinancialRepository(client);

    await expect(repository.acknowledgeFinancialSignal("user-1", "liquidity-critical")).resolves.toBeNull();

    expect(client.queries).toHaveLength(2);
    expect(client.queries[0]?.text).toContain("pg_advisory_xact_lock");
    expect(client.queries[0]?.values).toEqual(["user-1"]);
    expect(client.queries[1]?.text).toContain("WHERE owner_id = $1 AND signal_id = $2");
    expect(client.queries[1]?.text).toContain("status IN ('active', 'acknowledged')");
    expect(client.queries[1]?.values).toEqual(["user-1", "liquidity-critical"]);
  });

  it("filters signal history by authenticated owner and optional status", async () => {
    const client = createClient();
    const repository = new PostgresFinancialRepository(client);

    await expect(repository.getFinancialSignals("user-2", "resolved")).resolves.toEqual([]);

    expect(client.queries).toHaveLength(1);
    expect(client.queries[0]?.text).toContain("WHERE owner_id = $1");
    expect(client.queries[0]?.text).toContain("status = $2");
    expect(client.queries[0]?.values).toEqual(["user-2", "resolved"]);
    expect(client.queries[0]?.text).toContain("ORDER BY last_detected_at DESC");
  });

  it("does not issue an account query for an empty ledger account set", async () => {
    const client = createClient();
    const repository = new PostgresFinancialRepository(client);

    await expect(repository.getLedgerEntries([])).resolves.toEqual([]);
    expect(client.queries).toHaveLength(0);
  });
});
