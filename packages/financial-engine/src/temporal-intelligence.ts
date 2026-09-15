import type { CurrencyCode, Transaction } from "@afrifinos/financial-domain";

export interface PeriodCashFlow {
  readonly period: string;
  readonly incomeMinor: bigint;
  readonly expenseMinor: bigint;
  readonly netCashFlowMinor: bigint;
  readonly transactionCount: number;
}

export interface RecurringTransaction {
  readonly key: string;
  readonly type: "expense" | "income";
  readonly currency: CurrencyCode;
  readonly amountMinor: bigint;
  readonly occurrenceCount: number;
  readonly averageIntervalDays: number;
  readonly confidence: number;
}

export interface TransactionAnomaly {
  readonly transactionId: string;
  readonly categoryId?: string;
  readonly amountMinor: bigint;
  readonly baselineAverageMinor: number;
  readonly zScore: number;
  readonly reason: "unusually_large_amount";
}

export interface TemporalIntelligence {
  readonly currency: CurrencyCode;
  readonly periods: readonly PeriodCashFlow[];
  readonly recurring: readonly RecurringTransaction[];
  readonly anomalies: readonly TransactionAnomaly[];
}

export interface MonthlyForecastBaseline {
  readonly monthsObserved: number;
  readonly averageMonthlyIncomeMinor: bigint;
  readonly averageMonthlyExpenseMinor: bigint;
}

function periodKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid transaction date: ${value}`);
  return date.toISOString().slice(0, 7);
}

function normalizedKey(transaction: Transaction): string {
  return (transaction.counterparty ?? transaction.description ?? "unknown")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function effectiveAmount(transaction: Transaction): bigint {
  return transaction.total.amountMinor < 0n ? -transaction.total.amountMinor : transaction.total.amountMinor;
}

export function calculatePeriodCashFlow(
  transactions: readonly Transaction[],
  currency: CurrencyCode,
): readonly PeriodCashFlow[] {
  const buckets = new Map<string, PeriodCashFlow>();

  for (const transaction of transactions) {
    if (transaction.total.currency !== currency) continue;
    if (transaction.type === "transfer" || transaction.type === "adjustment" || transaction.type === "reversal") continue;

    const period = periodKey(transaction.occurredAt);
    const current = buckets.get(period) ?? {
      period,
      incomeMinor: 0n,
      expenseMinor: 0n,
      netCashFlowMinor: 0n,
      transactionCount: 0,
    };
    const amount = effectiveAmount(transaction);
    const isIncome = transaction.type === "income" || transaction.type === "refund";
    const incomeMinor = current.incomeMinor + (isIncome ? amount : 0n);
    const expenseMinor = current.expenseMinor + (isIncome ? 0n : amount);

    buckets.set(period, {
      period,
      incomeMinor,
      expenseMinor,
      netCashFlowMinor: incomeMinor - expenseMinor,
      transactionCount: current.transactionCount + 1,
    });
  }

  return [...buckets.values()].sort((a, b) => a.period.localeCompare(b.period));
}

export function calculateMonthlyForecastBaseline(
  periods: readonly PeriodCashFlow[],
): MonthlyForecastBaseline {
  if (periods.length === 0) {
    return {
      monthsObserved: 0,
      averageMonthlyIncomeMinor: 0n,
      averageMonthlyExpenseMinor: 0n,
    };
  }

  const totalIncome = periods.reduce((sum, period) => sum + period.incomeMinor, 0n);
  const totalExpense = periods.reduce((sum, period) => sum + period.expenseMinor, 0n);
  const divisor = BigInt(periods.length);

  return {
    monthsObserved: periods.length,
    averageMonthlyIncomeMinor: totalIncome / divisor,
    averageMonthlyExpenseMinor: totalExpense / divisor,
  };
}

export function detectRecurringTransactions(
  transactions: readonly Transaction[],
  currency: CurrencyCode,
): readonly RecurringTransaction[] {
  const groups = new Map<string, Transaction[]>();

  for (const transaction of transactions) {
    if (transaction.total.currency !== currency) continue;
    if (transaction.type !== "expense" && transaction.type !== "income") continue;
    const key = `${transaction.type}:${normalizedKey(transaction)}:${transaction.total.currency}`;
    const group = groups.get(key) ?? [];
    group.push(transaction);
    groups.set(key, group);
  }

  const results: RecurringTransaction[] = [];
  for (const [key, group] of groups) {
    if (group.length < 3) continue;
    const sorted = [...group].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    const intervals: number[] = [];
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = new Date(sorted[index - 1].occurredAt).getTime();
      const current = new Date(sorted[index].occurredAt).getTime();
      intervals.push((current - previous) / 86_400_000);
    }

    const averageIntervalDays = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
    const intervalDeviation = intervals.reduce((sum, value) => sum + Math.abs(value - averageIntervalDays), 0) / intervals.length;
    const intervalConsistency = Math.max(0, 1 - intervalDeviation / Math.max(averageIntervalDays, 1));
    if (averageIntervalDays < 20 || averageIntervalDays > 40 || intervalConsistency < 0.65) continue;

    const amountMinor = sorted.reduce((sum, transaction) => sum + effectiveAmount(transaction), 0n) / BigInt(sorted.length);
    results.push({
      key,
      type: sorted[0].type as "expense" | "income",
      currency,
      amountMinor,
      occurrenceCount: sorted.length,
      averageIntervalDays: Number(averageIntervalDays.toFixed(1)),
      confidence: Number(Math.min(1, 0.5 + 0.15 * Math.min(sorted.length - 3, 3) + 0.35 * intervalConsistency).toFixed(3)),
    });
  }

  return results.sort((a, b) => b.confidence - a.confidence);
}

export function detectSpendingAnomalies(
  transactions: readonly Transaction[],
  currency: CurrencyCode,
): readonly TransactionAnomaly[] {
  const expenses = transactions.filter(
    (transaction) => transaction.total.currency === currency && transaction.type === "expense",
  );
  const groups = new Map<string, Transaction[]>();

  for (const transaction of expenses) {
    const key = transaction.categoryId ?? normalizedKey(transaction);
    const group = groups.get(key) ?? [];
    group.push(transaction);
    groups.set(key, group);
  }

  const anomalies: TransactionAnomaly[] = [];
  for (const group of groups.values()) {
    if (group.length < 5) continue;
    const values = group.map(effectiveAmount).map(Number);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
    const standardDeviation = Math.sqrt(variance);
    if (standardDeviation === 0) continue;

    for (const transaction of group) {
      const zScore = (Number(effectiveAmount(transaction)) - mean) / standardDeviation;
      if (zScore >= 2) {
        anomalies.push({
          transactionId: transaction.transactionId,
          categoryId: transaction.categoryId,
          amountMinor: effectiveAmount(transaction),
          baselineAverageMinor: mean,
          zScore: Number(zScore.toFixed(2)),
          reason: "unusually_large_amount",
        });
      }
    }
  }

  return anomalies.sort((a, b) => b.zScore - a.zScore);
}

export function buildTemporalIntelligence(
  transactions: readonly Transaction[],
  currency: CurrencyCode,
): TemporalIntelligence {
  return {
    currency,
    periods: calculatePeriodCashFlow(transactions, currency),
    recurring: detectRecurringTransactions(transactions, currency),
    anomalies: detectSpendingAnomalies(transactions, currency),
  };
}
