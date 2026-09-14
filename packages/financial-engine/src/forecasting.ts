import type { CurrencyCode } from "@afrifinos/financial-domain";
import type { RecurringTransaction } from "./temporal-intelligence.js";

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

function projectedRecurringDaily(recurring: readonly RecurringTransaction[], type: "income" | "expense"): number {
  return recurring
    .filter((item) => item.type === type)
    .reduce((sum, item) => sum + Number(item.amountMinor) / Math.max(item.averageIntervalDays, 1), 0);
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
  const baselineIncomePerDay = dailyAmount(BigInt(input.averageMonthlyIncomeMinor));
  const baselineExpensePerDay = dailyAmount(BigInt(input.averageMonthlyExpenseMinor));
  const recurringIncomePerDay = projectedRecurringDaily(input.recurring ?? [], "income");
  const recurringExpensePerDay = projectedRecurringDaily(input.recurring ?? [], "expense");
  const incomePerDay = Math.max(baselineIncomePerDay, recurringIncomePerDay);
  const expensePerDay = Math.max(baselineExpensePerDay, recurringExpensePerDay);
  const points: ForecastPoint[] = [];
  let balance = startingBalanceMinor;
  let projectedIncomeMinor = 0n;
  let projectedExpenseMinor = 0n;
  let minimumProjectedBalanceMinor = startingBalanceMinor;
  let runwayDays: number | null = null;
  const start = new Date(input.asOf ?? new Date().toISOString());

  if (Number.isNaN(start.getTime())) throw new Error(`Invalid forecast date: ${input.asOf}`);
  if (incomePerDay < 0 || expensePerDay < 0) throw new Error("Forecast rates cannot be negative");

  for (let day = 1; day <= horizonDays; day += 1) {
    const income = BigInt(Math.round(incomePerDay));
    const expense = BigInt(Math.round(expensePerDay));
    balance += income - expense;
    projectedIncomeMinor += income;
    projectedExpenseMinor += expense;
    minimumProjectedBalanceMinor = balance < minimumProjectedBalanceMinor ? balance : minimumProjectedBalanceMinor;

    if (runwayDays === null && balance <= 0n && expensePerDay > incomePerDay) runwayDays = day;

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
