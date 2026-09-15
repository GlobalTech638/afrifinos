import type {
  Account,
  Asset,
  Liability,
  Transaction,
  LedgerEntry,
  Obligation,
  SavingsGoal,
} from "@afrifinos/financial-domain";

export interface FinancialRepository {
  getAccounts(ownerId: string): Promise<readonly Account[]>;
  saveTransaction(transaction: Transaction): Promise<void>;
  saveLedgerEntries(entries: readonly LedgerEntry[]): Promise<void>;
  getTransactions(ownerId: string, from?: string, to?: string): Promise<readonly Transaction[]>;
  getLedgerEntries(accountIds: readonly string[], from?: string, to?: string): Promise<readonly LedgerEntry[]>;
  getAssets(ownerId: string): Promise<readonly Asset[]>;
  getLiabilities(ownerId: string): Promise<readonly Liability[]>;
  getObligations(ownerId: string): Promise<readonly Obligation[]>;
  getSavingsGoals(ownerId: string): Promise<readonly SavingsGoal[]>;
}

export interface TransactionWriteRepository {
  saveTransactionWithLedger(
    transaction: Transaction,
    entries: readonly LedgerEntry[],
  ): Promise<void>;
}
