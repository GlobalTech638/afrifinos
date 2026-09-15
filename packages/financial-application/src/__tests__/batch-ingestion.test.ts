import { describe, expect, it } from "vitest";
import type { LedgerEntry, Transaction } from "@afrifinos/financial-domain";
import type { TransactionWriteRepository } from "@afrifinos/financial-persistence";
import { ingestTransactionBatch } from "../batch-ingestion.js";

class InMemoryWriteRepository implements TransactionWriteRepository {
  readonly transactions: Transaction[] = [];
  readonly entries: LedgerEntry[] = [];

  async saveTransactionWithLedger(transaction: Transaction, entries: readonly LedgerEntry[]): Promise<void> {
    this.transactions.push(transaction);
    this.entries.push(...entries);
  }
}

describe("ingestTransactionBatch", () => {
  it("persists unique transactions and reports duplicates", async () => {
    const repository = new InMemoryWriteRepository();
    const inputs = [
      {
        externalId: "ext-1",
        occurredAt: "2026-09-01T08:00:00Z",
        description: "Salary",
        amountMinor: "100000",
        currency: "KES" as const,
      },
      {
        externalId: "ext-1",
        occurredAt: "2026-09-01T08:00:00Z",
        description: "Salary",
        amountMinor: "100000",
        currency: "KES" as const,
      },
      {
        externalId: "ext-2",
        occurredAt: "2026-09-02T08:00:00Z",
        description: "Groceries",
        amountMinor: "2500",
        currency: "KES" as const,
      },
    ];

    const result = await ingestTransactionBatch(repository, {
      ownerId: "user-1",
      primaryAccountId: "mpesa",
      counterAccountId: "income",
      inputs,
      sourceKind: "csv",
      providerId: "csv-import",
      transactionIdFor: (input) => `tx-${input.externalId}`,
    });

    expect(result.persisted).toHaveLength(2);
    expect(result.duplicates).toHaveLength(1);
    expect(repository.transactions).toHaveLength(2);
    expect(repository.entries).toHaveLength(4);
  });
});
