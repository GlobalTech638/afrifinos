import type { CurrencyCode, Transaction } from "@afrifinos/financial-domain";

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

  const values = [...monthly.values()].map(Number);
  if (values.length < 2) return { monthlyExpenseCoefficient: null, normalizedVolatility: null };
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (mean <= 0) return { monthlyExpenseCoefficient: null, normalizedVolatility: null };
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
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
    months: Math.max(0, Number(liquidBalanceMinor) / Number(averageMonthlyExpenseMinor)),
  };
}

export function calculateGoalProgress(goals: readonly { current: { amountMinor: bigint }; target: { amountMinor: bigint }; status: string }[]): GoalProgress {
  const active = goals.filter((goal) => goal.status === "active" || goal.status === "completed");
  if (!active.length) return { activeGoals: 0, weightedProgress: null };
  const progress = active.reduce((sum, goal) => {
    if (goal.target.amountMinor <= 0n) return sum;
    return sum + Math.min(1, Math.max(0, Number(goal.current.amountMinor) / Number(goal.target.amountMinor)));
  }, 0);
  return { activeGoals: active.length, weightedProgress: progress / active.length };
}

function absolute(value: bigint): bigint {
  return value < 0n ? -value : value;
}
