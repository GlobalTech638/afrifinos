import { describe, expect, it } from "vitest";
import { PostgresFinancialRepository, type SqlClient } from "../postgres.js";
import type { Transaction, LedgerEntry } from "@afrifinos/financial-domain";

function createClient(existingWatermark?: string): SqlClient & { queries: Array<{ text: string; values: readonly unknown[] }> } {
  let watermark = existingWatermark;
  const client = {
    queries: [] as Array<{ text: string; values: readonly unknown[] }>,
    async query<Row extends Record<string, unknown> = Record<string, unknown>>(text: string, values: readonly unknown[] = []) {
      client.queries.push({ text, values });
      let rows: Row[] = [];
      if (text.includes("INSERT INTO financial_signal_reconciliations")) {
        const incoming = String(values[1]);
        if (watermark === undefined || Date.parse(incoming) > Date.parse(watermark)) {
          watermark = incoming;
          rows = [{ owner_id: String(values[0]) } as Row];
        }
      }
      return { rows };
    },
    async transaction<T>(work: (tx: SqlClient) => Promise<T>): Promise<T> {
      return work(client);
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
  total: { amountMinor: 2500n, currency: "KES" },
  provenance: { sourceKind: "manual", importedAt: "2026-09-15T10:01:00Z" },
};

const entries: readonly LedgerEntry[] = [
  { entryId: "txn-1:primary", transactionId: "txn-1", accountId: "cash", currency: "KES", amountMinor: 2500n, direction: "debit", postedAt: transaction.occurredAt },
  { entryId: "txn-1:counter", transactionId: "txn-1", accountId: "expense", currency: "KES", amountMinor: 2500n, direction: "credit", postedAt: transaction.occurredAt },
];

describe("PostgresFinancialRepository", () => {
  it("rolls back signal watermark and row writes when reconciliation fails", async () => {
    let rolledBack = false;
    const client = {
      ...createClient(),
      async transaction<T>(work: (tx: SqlClient) => Promise<T>): Promise<T> {
        const tx = {
          ...this,
          async query<Row extends Record<string, unknown> = Record<string, unknown>>(
            text: string,
            values: readonly unknown[] = [],
          ) {
            if (text.includes("INSERT INTO financial_signals")) {
              throw new Error("simulated signal row write failure");
            }
            return this.queryBase<Row>(text, values);
          },
          queryBase: createClient().query,
        } as unknown as SqlClient;
        try {
          return await work(tx);
        } catch (error) {
          rolledBack = true;
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
      statement: "This reconciliation must roll back.",
      evidenceIds: [],
      detectedAt: "2026-09-19T10:00:00.000Z",
    }])).rejects.toThrow("simulated signal row write failure");

    expect(rolledBack).toBe(true);
    expect(client.queries.some((query) => query.text.includes("INSERT INTO financial_signal_reconciliations"))).toBe(true);
  });

  it("persists transaction and ledger entries in one transaction", async () => {
    const client = createClient();
    const repository = new PostgresFinancialRepository(client);

    await repository.saveTransactionWithLedger(transaction, entries);

    expect(client.queries).toHaveLength(3);
    expect(client.queries[0]?.text).toContain("INSERT INTO transactions");
    expect(client.queries[1]?.text).toContain("INSERT INTO ledger_entries");
    expect(client.queries[2]?.text).toContain("INSERT INTO ledger_entries");
    expect(client.queries[0]?.values[8]).toBe("2500");
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

    expect(client.queries).toHaveLength(1);
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

    expect(client.queries).toHaveLength(1);
    expect(client.queries.some((query) => query.text.includes("INSERT INTO financial_signal_reconciliations"))).toBe(false);
    expect(client.queries.some((query) => query.text.includes("INSERT INTO financial_signals"))).toBe(false);
  });

  it("rejects invalid reconciliation timestamps before issuing watermark SQL", async () => {
    const client = createClient();
    const repository = new PostgresFinancialRepository(client);

    await expect(repository.reconcileFinancialSignals("user-8", [], "not-a-timestamp"))
      .rejects.toThrow("Financial signal reconciliation timestamp must be valid");

    expect(client.queries).toHaveLength(1);
    expect(client.queries[0]?.text).toContain("pg_advisory_xact_lock");
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
    expect(client.queries.some((query) => query.text.includes("SET status = 'resolved'")).toBe(false);
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
