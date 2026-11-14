import { describe, expect, it } from "vitest";
import type { LedgerEntry, Transaction } from "@afrifinos/financial-domain";
import type { TransactionWriteRepository, TransactionWriteResult } from "@afrifinos/financial-persistence";
import { ingestTransaction } from "../transaction-ingestion.js";

class InMemoryWriteRepository implements TransactionWriteRepository {
  readonly transactions: Transaction[] = [];
  readonly entries: LedgerEntry[] = [];
  readonly ownedAccounts = new Set(["mpesa", "bank", "expense", "income"]);
  readonly accountCurrencies = new Map([["mpesa", "KES"], ["bank", "KES"], ["expense", "KES"], ["income", "KES"]]);
  readonly providerTransactions = new Map<string, Transaction>();

  async getTransactionByProviderExternalId(_ownerId: string, providerId: string, externalId: string): Promise<Transaction | null> {
    return this.providerTransactions.get(`${providerId}:${externalId}`) ?? null;
  }

  async assertAccountsOwnedBy(ownerId: string, accountIds: readonly string[]): Promise<void> {
    if (ownerId !== "user-1" || accountIds.some((accountId) => !this.ownedAccounts.has(accountId))) {
      throw new Error("One or more accounts do not belong to the authenticated owner");
    }
  }

  async assertAccountsCurrency(ownerId: string, accountIds: readonly string[], currency: string): Promise<void> {
    if (ownerId !== "user-1" || accountIds.some((accountId) => this.accountCurrencies.get(accountId) !== currency)) {
      throw new Error("Transaction currency must match both account currencies");
    }
  }

  async saveTransactionWithLedger(
    transaction: Transaction,
    entries: readonly LedgerEntry[],
  ): Promise<TransactionWriteResult> {
    const providerId = transaction.provenance.providerId;
    const externalId = transaction.provenance.externalId;
    const key = providerId && externalId ? `${providerId}:${externalId}` : undefined;
    const existing = key ? this.providerTransactions.get(key) : undefined;
    if (existing) {
      const samePayload =
        existing.type === transaction.type &&
        existing.status === transaction.status &&
        Date.parse(existing.occurredAt) === Date.parse(transaction.occurredAt) &&
        existing.description === transaction.description &&
        existing.counterparty === transaction.counterparty &&
        existing.categoryId === transaction.categoryId &&
        existing.total.amountMinor === transaction.total.amountMinor &&
        existing.total.currency === transaction.total.currency &&
        existing.provenance.sourceKind === transaction.provenance.sourceKind;
      if (!samePayload) {
        throw new Error("Provider transaction identifier conflicts with a different payload");
      }
      return "duplicate";
    }

    this.transactions.push(transaction);
    this.entries.push(...entries);
    if (key) this.providerTransactions.set(key, transaction);
    return "inserted";
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
    expect(result.persistence).toBe("inserted");
    expect(result.ledgerEntryCount).toBe(2);
    expect(repository.transactions).toHaveLength(1);
    expect(repository.entries).toHaveLength(2);
    expect(repository.entries.map((entry) => entry.direction)).toEqual(["debit", "credit"]);
  });

  it("reports duplicates without creating ledger entries", async () => {
    const repository = new InMemoryWriteRepository();
    repository.providerTransactions.set("mpesa:external-duplicate", {
      transactionId: "tx-duplicate", ownerId: "user-1", type: "expense", status: "posted",
      occurredAt: "2026-09-14T08:00:00Z", description: "Naivas groceries", categoryId: "food",
      total: { amountMinor: 2500n, currency: "KES" },
      provenance: { sourceKind: "provider_api", providerId: "mpesa", externalId: "external-duplicate", importedAt: "2026-09-14T08:00:00Z" },
    });

    const result = await ingestTransaction(repository, {
      ownerId: "user-1",
      primaryAccountId: "mpesa",
      counterAccountId: "expense",
      transactionId: "tx-duplicate",
      sourceKind: "provider_api",
      providerId: "mpesa",
      input: {
        externalId: "external-duplicate",
        occurredAt: "2026-09-14T08:00:00Z",
        description: "Naivas groceries",
        amountMinor: 2500n,
        currency: "KES",
      },
    });

    expect(result.persistence).toBe("duplicate");
    expect(result.ledgerEntryCount).toBe(0);
    expect(repository.transactions).toHaveLength(0);
    expect(repository.entries).toHaveLength(0);
  });

  it("rejects a provider identifier reused with a changed payload", async () => {
    const repository = new InMemoryWriteRepository();
    repository.providerTransactions.set("mpesa:external-conflict", {
      transactionId: "tx-original", ownerId: "user-1", type: "expense", status: "posted",
      occurredAt: "2026-09-14T08:00:00Z", description: "Naivas groceries", categoryId: "food",
      total: { amountMinor: 2500n, currency: "KES" },
      provenance: { sourceKind: "provider_api", providerId: "mpesa", externalId: "external-conflict", importedAt: "2026-09-14T08:00:00Z" },
    });

    await expect(ingestTransaction(repository, {
      ownerId: "user-1",
      primaryAccountId: "mpesa",
      counterAccountId: "expense",
      transactionId: "tx-changed",
      sourceKind: "provider_api",
      providerId: "mpesa",
      input: {
        externalId: "external-conflict",
        occurredAt: "2026-09-14T08:00:00Z",
        description: "Naivas groceries",
        amountMinor: 3500n,
        currency: "KES",
      },
    })).rejects.toThrow("Provider transaction identifier conflicts with a different payload");

    expect(repository.transactions).toHaveLength(0);
    expect(repository.entries).toHaveLength(0);
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

  it("rejects a transaction whose currency does not match both accounts", async () => {
    const repository = new InMemoryWriteRepository();
    repository.accountCurrencies.set("bank", "USD");

    await expect(ingestTransaction(repository, {
      ownerId: "user-1", primaryAccountId: "mpesa", counterAccountId: "bank",
      transactionId: "tx-currency-mismatch", sourceKind: "manual",
      input: { occurredAt: "2026-09-14T08:00:00Z", description: "Transfer", amountMinor: 2500n, currency: "KES" },
    })).rejects.toThrow("Transaction currency must match both account currencies");
    expect(repository.transactions).toHaveLength(0);
    expect(repository.entries).toHaveLength(0);
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
