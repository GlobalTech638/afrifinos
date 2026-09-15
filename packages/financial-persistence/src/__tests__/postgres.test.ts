import { describe, expect, it } from "vitest";
import { PostgresFinancialRepository, type SqlClient } from "../postgres.js";
import type { Transaction, LedgerEntry } from "@afrifinos/financial-domain";

function createClient(): SqlClient & { queries: Array<{ text: string; values: readonly unknown[] }> } {
  const client = {
    queries: [] as Array<{ text: string; values: readonly unknown[] }>,
    async query<Row extends Record<string, unknown> = Record<string, unknown>>(text: string, values: readonly unknown[] = []) {
      client.queries.push({ text, values });
      return { rows: [] as Row[] };
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

  it("does not issue an account query for an empty ledger account set", async () => {
    const client = createClient();
    const repository = new PostgresFinancialRepository(client);

    await expect(repository.getLedgerEntries([])).resolves.toEqual([]);
    expect(client.queries).toHaveLength(0);
  });
});
