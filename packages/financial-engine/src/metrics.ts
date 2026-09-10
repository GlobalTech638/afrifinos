import type { LedgerEntry } from "@afrifinos/financial-domain";
import { signedAmount } from "@afrifinos/financial-domain";

export interface CashFlowSummary {
  readonly incomeMinor: bigint;
  readonly expenseMinor: bigint;
  readonly netCashFlowMinor: bigint;
}

export interface DebtMetrics {
  readonly debtServiceMinor: bigint;
  readonly incomeMinor: bigint;
  readonly debtBurdenRatio: number | null;
}

export interface SavingsMetrics {
  readonly incomeMinor: bigint;
  readonly savingsMinor: bigint;
  readonly savingsRate: number | null;
}

/**
 * Computes account-level cash movement from classified ledger entries.
 * The caller supplies the account IDs that belong to the user's cash/liquid
 * assets and the transaction IDs classified as income or expense.
 */
export function calculateCashFlow(
  entries: readonly LedgerEntry[],
  incomeTransactionIds: ReadonlySet<string>,
  expenseTransactionIds: ReadonlySet<string>,
): CashFlowSummary {
  let incomeMinor = 0n;
  let expenseMinor = 0n;

  for (const entry of entries) {
    const amount = signedAmount(entry);
    if (incomeTransactionIds.has(entry.transactionId) && amount > 0n) {
      incomeMinor += amount;
    }
    if (expenseTransactionIds.has(entry.transactionId) && amount < 0n) {
      expenseMinor += -amount;
    }
  }

  return {
    incomeMinor,
    expenseMinor,
    netCashFlowMinor: incomeMinor - expenseMinor,
  };
}

export function calculateSavingsMetrics(
  incomeMinor: bigint,
  expenseMinor: bigint,
): SavingsMetrics {
  if (incomeMinor <= 0n) {
    return { incomeMinor, savingsMinor: incomeMinor - expenseMinor, savingsRate: null };
  }

  const savingsMinor = incomeMinor - expenseMinor;
  return {
    incomeMinor,
    savingsMinor,
    savingsRate: Number(savingsMinor) / Number(incomeMinor),
  };
}

export function calculateDebtMetrics(
  incomeMinor: bigint,
  debtServiceMinor: bigint,
): DebtMetrics {
  if (incomeMinor <= 0n) {
    return { debtServiceMinor, incomeMinor, debtBurdenRatio: null };
  }

  return {
    debtServiceMinor,
    incomeMinor,
    debtBurdenRatio: Number(debtServiceMinor) / Number(incomeMinor),
  };
}
