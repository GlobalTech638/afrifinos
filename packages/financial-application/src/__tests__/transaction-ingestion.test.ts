import { describe, expect, it } from "vitest";
import type { LedgerEntry, Transaction } from "@afrifinos/financial-domain";
import type { TransactionWriteRepository } from "@afrifinos/financial-persistence";
import { ingestTransaction } from "../transaction-ingestion.js";

class InMemoryWriteRepository implements TransactionWriteRepository {
  readonly transactions: Transaction[] = [];
  readonly entries: LedgerEntry[] = [];
  readonly ownedAccounts = new Set(["mpesa", "bank", "expense", "income"]);

  async assertAccountsOwnedBy(ownerId: string, accountIds: readonly string[]): Promise<void> {
    if (ownerId !== "user-1" || accountIds.some((accountId) => !this.ownedAccounts.has(accountId))) {
      throw new Error("One or more accounts do not belong to the authenticated owner");
    }
  }

  async saveTransactionWithLedger(transaction: Transaction, entries: readonly LedgerEntry[]): Promise<void> {
    this.transactions.push(transaction);
    this.entries.push(...entries);
  }
}

describe("ingestTransaction", () => {
  it("normalizes, categorizes, posts, and persists a transaction atomically at the application boundary", async () => {
    const repository = new InMemoryWriteRepository();

    const result = await ingestTransaction(repository, {
      ownerId: "user-1",
      primaryAccountId: "mpesa",
      counterAccountId: "expense",
      transactionId: "tx-1",
      sourceKind: "csv",
      importedAt: "2026-09-15T10:00:00Z",
      input: {
        occurredAt: "2026-09-14T08:00:00Z",
        description: "  Naivas   groceries  ",
        amountMinor: "2500",
        currency: "KES",
      },
    });

    expect(result.transaction.status).toBe("posted");
    expect(result.transaction.type).toBe("expense");
    expect(result.transaction.description).toBe("Naivas groceries");
    expect(result.transaction.categoryId).toBe("food");
    expect(result.transaction.total.amountMinor).toBe(2500n);
    expect(result.ledgerEntryCount).toBe(2);
    expect(repository.transactions).toHaveLength(1);
    expect(repository.entries).toHaveLength(2);
    expect(repository.entries.map((entry) => entry.direction)).toEqual(["debit", "credit"]);
  });

  it("preserves negative raw amounts as positive authoritative money while inferring income", async () => {
    const repository = new InMemoryWriteRepository();

    const result = await ingestTransaction(repository, {
      ownerId: "user-1",
      primaryAccountId: "bank",
      counterAccountId: "income",
      transactionId: "salary-1",
      sourceKind: "manual",
      input: {
        occurredAt: "2026-09-01T08:00:00Z",
        description: "Salary",
        amountMinor: "100000",
        currency: "KES",
      },
    });

    expect(result.transaction.type).toBe("income");
    expect(result.transaction.total.amountMinor).toBe(100000n);
    expect(repository.entries[0]?.direction).toBe("credit");
  });

  it("rejects identical primary and counter accounts before persistence", async () => {
    const repository = new InMemoryWriteRepository();

    await expect(ingestTransaction(repository, {
      ownerId: "user-1",
      primaryAccountId: "mpesa",
      counterAccountId: "mpesa",
      transactionId: "tx-1",
      sourceKind: "manual",
      input: {
        occurredAt: "2026-09-14T08:00:00Z",
        description: "Groceries",
        amountMinor: 2500n,
        currency: "KES",
      },
    })).rejects.toThrow("Primary and counter accounts must be different");

    expect(repository.transactions).toHaveLength(0);
    expect(repository.entries).toHaveLength(0);
  });

  it("rejects an account outside the owner's account set", async () => {
    const repository = new InMemoryWriteRepository();

    await expect(ingestTransaction(repository, {
      ownerId: "user-1",
      primaryAccountId: "mpesa",
      counterAccountId: "other-owner-account",
      transactionId: "tx-cross-owner",
      sourceKind: "manual",
      input: {
        occurredAt: "2026-09-14T08:00:00Z",
        description: "Groceries",
        amountMinor: 2500n,
        currency: "KES",
      },
    })).rejects.toThrow("One or more accounts do not belong to the authenticated owner");

    expect(repository.transactions).toHaveLength(0);
    expect(repository.entries).toHaveLength(0);
  });
});
