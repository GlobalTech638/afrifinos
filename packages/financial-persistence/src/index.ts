import type {
  Account,
  Asset,
  Liability,
  Transaction,
  LedgerEntry,
  Obligation,
  SavingsGoal,
} from "@afrifinos/financial-domain";

export type PersistedSignalStatus = "active" | "acknowledged" | "resolved";
export interface FinancialSignalInput {
  readonly id: string;
  readonly category: string;
  readonly severity: "info" | "warning" | "critical";
  readonly status: "active" | "resolved" | "acknowledged";
  readonly title: string;
  readonly statement: string;
  readonly evidenceIds: readonly string[];
  readonly detectedAt: string;
}
export interface StoredFinancialSignal {
  readonly ownerId: string;
  readonly signalId: string;
  readonly category: string;
  readonly severity: "info" | "warning" | "critical";
  readonly status: PersistedSignalStatus;
  readonly title: string;
  readonly statement: string;
  readonly evidenceIds: readonly string[];
  readonly firstDetectedAt: string;
  readonly lastDetectedAt: string;
  readonly acknowledgedAt?: string;
  readonly resolvedAt?: string;
}
export interface FinancialRepository {
  reconcileFinancialSignals(ownerId: string, signals: readonly FinancialSignalInput[]): Promise<readonly StoredFinancialSignal[]>;
  acknowledgeFinancialSignal(ownerId: string, signalId: string): Promise<StoredFinancialSignal | null>;
  getFinancialSignals(ownerId: string, status?: PersistedSignalStatus): Promise<readonly StoredFinancialSignal[]>;
  ensureOwner(ownerId: string): Promise<void>;
  getAccounts(ownerId: string): Promise<readonly Account[]>;
  saveAccount(account: Account): Promise<void>;
  saveTransaction(transaction: Transaction): Promise<void>;
  saveLedgerEntries(entries: readonly LedgerEntry[]): Promise<void>;
  getTransactionByProviderExternalId(ownerId: string, providerId: string, externalId: string): Promise<Transaction | null>;
  getTransactions(ownerId: string, from?: string, to?: string): Promise<readonly Transaction[]>;
  getLedgerEntries(accountIds: readonly string[], from?: string, to?: string): Promise<readonly LedgerEntry[]>;
  getAssets(ownerId: string): Promise<readonly Asset[]>;
  getLiabilities(ownerId: string): Promise<readonly Liability[]>;
  getObligations(ownerId: string): Promise<readonly Obligation[]>;
  getSavingsGoals(ownerId: string): Promise<readonly SavingsGoal[]>;
}

export type TransactionWriteResult = "inserted" | "duplicate";

export interface TransactionWriteRepository {
  assertAccountsOwnedBy(ownerId: string, accountIds: readonly string[]): Promise<void>;
  getTransactionByProviderExternalId(ownerId: string, providerId: string, externalId: string): Promise<Transaction | null>;
  saveTransactionWithLedger(transaction: Transaction, entries: readonly LedgerEntry[]): Promise<TransactionWriteResult>;
}

export * from "./postgres.js";
export * from "./pg-client.js";
export * from "./migration-runner.js";
