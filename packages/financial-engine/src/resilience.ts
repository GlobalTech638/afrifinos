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
  for (const transaction of transactions) {
    if (transaction.currency !== currency || transaction.type !== "expense") continue;
    const date = new Date(transaction.occurredAt);
    if (Number.isNaN(date.getTime())) continue;
    const period = date.toISOString().slice(0, 7);
    monthly.set(period, (monthly.get(period) ?? 0n) + absolute(transaction.total.amountMinor));
  }

  const values = [...monthly.values()];
  if (values.length < 2) return { monthlyExpenseCoefficient: null, normalizedVolatility: null };

  // Normalize each month against the exact bigint total so large monetary
  // values do not silently lose precision before the coefficient is computed.
  const total = values.reduce((sum, value) => sum + value, 0n);
  if (total <= 0n) return { monthlyExpenseCoefficient: null, normalizedVolatility: null };

  const mean = ratioOfBigInts(total, BigInt(values.length));
  if (mean <= 0) return { monthlyExpenseCoefficient: null, normalizedVolatility: null };

  const deviations = values.map((value) => ratioOfBigInts(value, 1n) - mean);
  const variance = deviations.reduce((sum, deviation) => sum + deviation ** 2, 0) / values.length;
  const coefficient = Math.sqrt(variance) / mean;
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
  const progress = active.reduce((sum, goal) => {
    if (goal.target.amountMinor <= 0n) return sum;
    return sum + Math.min(1, Math.max(0, ratioOfBigInts(goal.current.amountMinor, goal.target.amountMinor)));
  }, 0);
  return { activeGoals: active.length, weightedProgress: progress / active.length };
}

function absolute(value: bigint): bigint {
  return value < 0n ? -value : value;
}
