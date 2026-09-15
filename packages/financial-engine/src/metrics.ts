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
 * Converts a bigint ratio to a JavaScript number without first converting
 * either operand to Number. This avoids Infinity/precision loss for large
 * monetary values while preserving the ratio's useful decimal precision.
 */
export function ratioOfBigInts(numerator: bigint, denominator: bigint): number {
  if (denominator === 0n) throw new Error("Cannot divide by zero");

  const sign = (numerator < 0n) === (denominator < 0n) ? 1 : -1;
  const numeratorDigits = absolute(numerator).toString();
  const denominatorDigits = absolute(denominator).toString();
  const significantDigits = 15;
  const numeratorPrecision = Math.min(significantDigits, numeratorDigits.length);
  const denominatorPrecision = Math.min(significantDigits, denominatorDigits.length);
  const numeratorSignificand = Number(numeratorDigits.slice(0, numeratorPrecision));
  const denominatorSignificand = Number(denominatorDigits.slice(0, denominatorPrecision));
  const exponent =
    numeratorDigits.length - numeratorPrecision -
    (denominatorDigits.length - denominatorPrecision);

  return sign * (numeratorSignificand / denominatorSignificand) * 10 ** exponent;
}

/**
 * Computes account-level cash movement from classified ledger entries.
 * The caller supplies the transaction IDs classified as income or expense.
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
    savingsRate: ratioOfBigInts(savingsMinor, incomeMinor),
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
    debtBurdenRatio: ratioOfBigInts(debtServiceMinor, incomeMinor),
  };
}

function absolute(value: bigint): bigint {
  return value < 0n ? -value : value;
}
