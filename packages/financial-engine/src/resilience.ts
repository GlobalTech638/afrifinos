import type { CurrencyCode, Transaction } from "@afrifinos/financial-domain";
import { ratioOfBigInts } from "./metrics.js";

export interface SpendingVolatility {
  readonly monthlyExpenseCoefficient: number | null;
  readonly normalizedVolatility: number | null;
}

export interface EmergencyRunway {
  readonly liquidBalanceMinor: bigint;
  readonly averageMonthlyExpenseMinor: bigint;
  readonly months: number | null;
}

export interface GoalProgress {
  readonly activeGoals: number;
  readonly weightedProgress: number | null;
}

export function calculateSpendingVolatility(
  transactions: readonly Transaction[],
  currency: CurrencyCode,
): SpendingVolatility {
  const monthly = new Map<string, bigint>();
  let firstMonth: number | undefined;
  let lastMonth: number | undefined;
  for (const transaction of transactions) {
    if (transaction.total.currency !== currency ||
      (transaction.type !== "expense" && transaction.type !== "fee" && transaction.type !== "refund")) continue;
    const date = new Date(transaction.occurredAt);
    if (Number.isNaN(date.getTime())) continue;
    const monthIndex = date.getUTCFullYear() * 12 + date.getUTCMonth();
    firstMonth = firstMonth === undefined ? monthIndex : Math.min(firstMonth, monthIndex);
    lastMonth = lastMonth === undefined ? monthIndex : Math.max(lastMonth, monthIndex);
    const period = date.toISOString().slice(0, 7);
    const signedExpense = transaction.type === "refund"
      ? -absolute(transaction.total.amountMinor)
      : absolute(transaction.total.amountMinor);
    monthly.set(period, (monthly.get(period) ?? 0n) + signedExpense);
  }

  if (firstMonth === undefined || lastMonth === undefined || lastMonth - firstMonth < 1) {
    return { monthlyExpenseCoefficient: null, normalizedVolatility: null };
  }
  // Include zero-spend months and net refunds against expenses. A refund must
  // never create negative monthly spending or inflate the volatility baseline.
  const values: bigint[] = [];
  for (let month = firstMonth; month <= lastMonth; month += 1) {
    const year = Math.floor(month / 12);
    const monthOfYear = month % 12;
    const key = `${year}-${String(monthOfYear + 1).padStart(2, "0")}`;
    const net = monthly.get(key) ?? 0n;
    values.push(net > 0n ? net : 0n);
  }

  const total = values.reduce((sum, value) => sum + value, 0n);
  if (total <= 0n) return { monthlyExpenseCoefficient: null, normalizedVolatility: null };

  // Compute the coefficient from ratios rather than converting raw minor-unit
  // balances to Number. This keeps the metric stable for very large ledgers.
  const meanRatio = 1 / values.length;
  const normalizedValues = values.map((value) => ratioOfBigInts(value, total) / meanRatio);
  const variance = normalizedValues.reduce((sum, normalized) => sum + (normalized - 1) ** 2, 0) / values.length;
  const coefficient = Math.sqrt(variance);

  return {
    monthlyExpenseCoefficient: coefficient,
    normalizedVolatility: Math.min(1, coefficient),
  };
}

export function calculateEmergencyRunway(
  liquidBalanceMinor: bigint,
  averageMonthlyExpenseMinor: bigint,
): EmergencyRunway {
  if (averageMonthlyExpenseMinor <= 0n) {
    return { liquidBalanceMinor, averageMonthlyExpenseMinor, months: null };
  }
  return {
    liquidBalanceMinor,
    averageMonthlyExpenseMinor,
    months: Math.max(0, ratioOfBigInts(liquidBalanceMinor, averageMonthlyExpenseMinor)),
  };
}

export function calculateGoalProgress(goals: readonly { current: { amountMinor: bigint }; target: { amountMinor: bigint }; status: string }[]): GoalProgress {
  const active = goals.filter((goal) => goal.status === "active" || goal.status === "completed");
  if (!active.length) return { activeGoals: 0, weightedProgress: null };
  let totalTargetMinor = 0n;
  let totalProgressMinor = 0n;
  for (const goal of active) {
    if (goal.target.amountMinor <= 0n) continue;
    totalTargetMinor += goal.target.amountMinor;
    const progress = goal.current.amountMinor < 0n ? 0n
      : goal.current.amountMinor > goal.target.amountMinor ? goal.target.amountMinor
        : goal.current.amountMinor;
    totalProgressMinor += progress;
  }
  return {
    activeGoals: active.length,
    weightedProgress: totalTargetMinor > 0n ? ratioOfBigInts(totalProgressMinor, totalTargetMinor) : null,
  };
}

function absolute(value: bigint): bigint {
  return value < 0n ? -value : value;
}
