import type { CurrencyCode } from "@afrifinos/financial-domain";
import type { RecurringCadence, RecurringTransaction } from "./temporal-intelligence.js";

export type ForecastHorizonDays = 30 | 60 | 90;

export interface ForecastPoint {
  readonly date: string;
  readonly projectedIncomeMinor: bigint;
  readonly projectedExpenseMinor: bigint;
  readonly projectedNetCashFlowMinor: bigint;
  readonly projectedBalanceMinor: bigint;
}

export interface CashForecast {
  readonly currency: CurrencyCode;
  readonly startingBalanceMinor: bigint;
  readonly horizonDays: ForecastHorizonDays;
  readonly projectedIncomeMinor: bigint;
  readonly projectedExpenseMinor: bigint;
  readonly projectedNetCashFlowMinor: bigint;
  readonly endingBalanceMinor: bigint;
  readonly minimumProjectedBalanceMinor: bigint;
  readonly runwayDays: number | null;
  readonly points: readonly ForecastPoint[];
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function dailyAmount(monthlyAmount: bigint): number {
  return Number(monthlyAmount) / 30;
}

function cadenceIntervalDays(cadence: RecurringCadence): number {
  switch (cadence) {
    case "weekly": return 7;
    case "biweekly": return 14;
    case "monthly": return 30;
    case "quarterly": return 91;
    case "annual": return 365;
  }
}

function scheduledDays(item: RecurringTransaction, horizonDays: number): Set<number> {
  const interval = Math.max(1, Math.round(item.averageIntervalDays || cadenceIntervalDays(item.cadence)));
  const days = new Set<number>();
  for (let day = Math.max(1, Math.round(item.averageIntervalDays)); day <= horizonDays; day += interval) {
    days.add(day);
  }
  return days;
}

function recurringEvents(
  recurring: readonly RecurringTransaction[],
  horizonDays: number,
  type: "income" | "expense",
): Map<number, bigint> {
  const events = new Map<number, bigint>();
  for (const item of recurring) {
    if (item.type !== type) continue;
    const days = scheduledDays(item, horizonDays);
    for (const day of days) {
      events.set(day, (events.get(day) ?? 0n) + item.averageAmountMinor);
    }
  }
  return events;
}

export function forecastCashFlow(input: {
  readonly currency: CurrencyCode;
  readonly startingBalanceMinor: bigint | number | string;
  readonly averageMonthlyIncomeMinor: bigint | number | string;
  readonly averageMonthlyExpenseMinor: bigint | number | string;
  readonly recurring?: readonly RecurringTransaction[];
  readonly asOf?: string;
  readonly horizonDays?: ForecastHorizonDays;
}): CashForecast {
  const horizonDays = input.horizonDays ?? 90;
  const startingBalanceMinor = BigInt(input.startingBalanceMinor);
  const averageMonthlyIncomeMinor = BigInt(input.averageMonthlyIncomeMinor);
  const averageMonthlyExpenseMinor = BigInt(input.averageMonthlyExpenseMinor);
  if (averageMonthlyIncomeMinor < 0n || averageMonthlyExpenseMinor < 0n) {
    throw new Error("Forecast rates cannot be negative");
  }

  const baselineIncomePerDay = dailyAmount(averageMonthlyIncomeMinor);
  const baselineExpensePerDay = dailyAmount(averageMonthlyExpenseMinor);
  const recurringIncome = recurringEvents(input.recurring ?? [], horizonDays, "income");
  const recurringExpense = recurringEvents(input.recurring ?? [], horizonDays, "expense");
  const points: ForecastPoint[] = [];
  let balance = startingBalanceMinor;
  let projectedIncomeMinor = 0n;
  let projectedExpenseMinor = 0n;
  let minimumProjectedBalanceMinor = startingBalanceMinor;
  let runwayDays: number | null = null;
  const start = new Date(input.asOf ?? new Date().toISOString());

  if (Number.isNaN(start.getTime())) throw new Error(`Invalid forecast date: ${input.asOf}`);

  for (let day = 1; day <= horizonDays; day += 1) {
    const baselineIncome = BigInt(Math.round(baselineIncomePerDay));
    const baselineExpense = BigInt(Math.round(baselineExpensePerDay));
    const income = baselineIncome + (recurringIncome.get(day) ?? 0n);
    const expense = baselineExpense + (recurringExpense.get(day) ?? 0n);

    balance += income - expense;
    projectedIncomeMinor += income;
    projectedExpenseMinor += expense;
    minimumProjectedBalanceMinor = balance < minimumProjectedBalanceMinor ? balance : minimumProjectedBalanceMinor;

    if (runwayDays === null && balance <= 0n) runwayDays = day;

    points.push({
      date: addDays(start, day).toISOString(),
      projectedIncomeMinor: income,
      projectedExpenseMinor: expense,
      projectedNetCashFlowMinor: income - expense,
      projectedBalanceMinor: balance,
    });
  }

  return {
    currency: input.currency,
    startingBalanceMinor,
    horizonDays,
    projectedIncomeMinor,
    projectedExpenseMinor,
    projectedNetCashFlowMinor: projectedIncomeMinor - projectedExpenseMinor,
    endingBalanceMinor: balance,
    minimumProjectedBalanceMinor,
    runwayDays,
    points,
  };
}
