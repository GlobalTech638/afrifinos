import type { CurrencyCode, Obligation } from "@afrifinos/financial-domain";
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

function cadenceIntervalDays(cadence: RecurringCadence): number {
  switch (cadence) {
    case "weekly": return 7;
    case "biweekly": return 14;
    case "monthly": return 30;
    case "quarterly": return 91;
    case "annual": return 365;
  }
}

function nextOccurrenceDay(item: RecurringTransaction, start: Date): number | null {
  if (!item.lastObservedAt) return Math.max(1, Math.round(item.averageIntervalDays || cadenceIntervalDays(item.cadence)));

  const lastObserved = new Date(item.lastObservedAt);
  if (Number.isNaN(lastObserved.getTime())) return null;

  const elapsedDays = Math.floor((start.getTime() - lastObserved.getTime()) / 86_400_000);
  const interval = Math.max(1, Math.round(item.averageIntervalDays || cadenceIntervalDays(item.cadence)));
  const occurrencesPassed = Math.floor(Math.max(0, elapsedDays) / interval);
  const nextDay = occurrencesPassed * interval + interval - elapsedDays;
  return Math.max(1, nextDay);
}

function recurringEvents(
  recurring: readonly RecurringTransaction[],
  horizonDays: number,
  type: "income" | "expense",
  start: Date,
): Map<number, bigint> {
  const events = new Map<number, bigint>();
  for (const item of recurring) {
    if (item.type !== type) continue;
    const firstDay = nextOccurrenceDay(item, start);
    if (firstDay === null) continue;
    const interval = Math.max(1, Math.round(item.averageIntervalDays || cadenceIntervalDays(item.cadence)));
    for (let day = firstDay; day <= horizonDays; day += interval) {
      events.set(day, (events.get(day) ?? 0n) + item.averageAmountMinor);
    }
  }
  return events;
}

function obligationEvents(
  obligations: readonly Obligation[],
  horizonDays: number,
  start: Date,
  currency: CurrencyCode,
): Map<number, bigint> {
  const events = new Map<number, bigint>();
  for (const obligation of obligations) {
    if (obligation.status !== "active" || obligation.amount.currency !== currency || !obligation.dueAt) continue;
    const dueAt = new Date(obligation.dueAt);
    if (Number.isNaN(dueAt.getTime())) continue;

    const interval = 30;
    let day = Math.ceil((dueAt.getTime() - start.getTime()) / 86_400_000);
    if (obligation.recurring) {
      while (day < 1) day += interval;
    }
    if (day < 1) day = 1;

    while (day <= horizonDays) {
      events.set(day, (events.get(day) ?? 0n) + obligation.amount.amountMinor);
      if (!obligation.recurring) break;
      day += interval;
    }
  }
  return events;
}

function distributeMonthlyAmount(amountMinor: bigint, days: number): bigint[] {
  if (days <= 0) return [];
  const result = Array<bigint>(days).fill(amountMinor / BigInt(days));
  let remainder = amountMinor - result.reduce((sum, value) => sum + value, 0n);
  for (let index = 0; remainder > 0n; index = (index + 1) % days) {
    result[index] = (result[index] ?? 0n) + 1n;
    remainder -= 1n;
  }
  return result;
}

export function forecastCashFlow(input: {
  readonly currency: CurrencyCode;
  readonly startingBalanceMinor: bigint | number | string;
  readonly averageMonthlyIncomeMinor: bigint | number | string;
  readonly averageMonthlyExpenseMinor: bigint | number | string;
  readonly recurring?: readonly RecurringTransaction[];
  readonly obligations?: readonly Obligation[];
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

  const start = new Date(input.asOf ?? new Date().toISOString());
  if (Number.isNaN(start.getTime())) throw new Error(`Invalid forecast date: ${input.asOf}`);

  const baselineIncome = distributeMonthlyAmount(averageMonthlyIncomeMinor, 30);
  const baselineExpense = distributeMonthlyAmount(averageMonthlyExpenseMinor, 30);
  const recurringIncome = recurringEvents(input.recurring ?? [], horizonDays, "income", start);
  const recurringExpense = recurringEvents(input.recurring ?? [], horizonDays, "expense", start);
  const obligations = obligationEvents(input.obligations ?? [], horizonDays, start, input.currency);
  const points: ForecastPoint[] = [];
  let balance = startingBalanceMinor;
  let projectedIncomeMinor = 0n;
  let projectedExpenseMinor = 0n;
  let minimumProjectedBalanceMinor = startingBalanceMinor;
  let runwayDays: number | null = null;

  for (let day = 1; day <= horizonDays; day += 1) {
    const baselineDay = (day - 1) % 30;
    const income = (baselineIncome[baselineDay] ?? 0n) + (recurringIncome.get(day) ?? 0n);
    const expense = (baselineExpense[baselineDay] ?? 0n) + (recurringExpense.get(day) ?? 0n) + (obligations.get(day) ?? 0n);

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
