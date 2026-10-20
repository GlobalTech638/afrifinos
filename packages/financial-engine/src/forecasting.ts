import { currencyCode, getCurrencyDefinition, type CurrencyCode, type Obligation, type ObligationRecurrence } from "@afrifinos/financial-domain";
import type { RecurringCadence, RecurringTransaction } from "./temporal-intelligence.js";

export type ForecastHorizonDays = 30 | 60 | 90;
export type LiquidityRiskLevel = "healthy" | "watch" | "high" | "critical";

export interface LiquidityRisk {
  readonly level: LiquidityRiskLevel;
  readonly minimumProjectedBalanceMinor: bigint;
  readonly safetyBufferMinor: bigint;
  readonly shortfallMinor: bigint;
  readonly firstShortfallDate?: string;
}

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
  readonly liquidityRisk: LiquidityRisk;
  readonly points: readonly ForecastPoint[];
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function cadenceIntervalDays(cadence: RecurringCadence | ObligationRecurrence): number {
  switch (cadence) {
    case "weekly": return 7;
    case "biweekly": return 14;
    case "monthly": return 30;
    case "quarterly": return 91;
    case "annual": return 365;
    case "once": return 0;
  }
}

function nextOccurrenceDay(item: RecurringTransaction, start: Date): number | null {
  if (!item.lastObservedAt) return Math.max(1, Math.round(item.averageIntervalDays || cadenceIntervalDays(item.cadence)));
  const lastObserved = new Date(item.lastObservedAt);
  if (Number.isNaN(lastObserved.getTime())) return null;
  const elapsedDays = Math.floor((start.getTime() - lastObserved.getTime()) / 86_400_000);
  const interval = Math.max(1, Math.round(item.averageIntervalDays || cadenceIntervalDays(item.cadence)));
  const occurrencesPassed = Math.floor(Math.max(0, elapsedDays) / interval);
  return Math.max(1, occurrencesPassed * interval + interval - elapsedDays);
}

function recurringEvents(recurring: readonly RecurringTransaction[], horizonDays: number, type: "income" | "expense", start: Date, currency: CurrencyCode): Map<number, bigint> {
  const events = new Map<number, bigint>();
  for (const item of recurring) {
    if (item.type !== type || item.currency !== currency) continue;
    const firstDay = nextOccurrenceDay(item, start);
    if (firstDay === null) continue;
    const interval = Math.max(1, Math.round(item.averageIntervalDays || cadenceIntervalDays(item.cadence)));
    for (let day = firstDay; day <= horizonDays; day += interval) {
      events.set(day, (events.get(day) ?? 0n) + item.averageAmountMinor);
    }
  }
  return events;
}

function obligationEvents(obligations: readonly Obligation[], horizonDays: number, start: Date, currency: CurrencyCode): Map<number, bigint> {
  const events = new Map<number, bigint>();
  for (const obligation of obligations) {
    if (obligation.status !== "active" || obligation.amount.currency !== currency || !obligation.dueAt) continue;
    const dueAt = new Date(obligation.dueAt);
    if (Number.isNaN(dueAt.getTime())) continue;
    const recurrence: ObligationRecurrence = obligation.recurring ? (obligation.recurrence ?? "monthly") : "once";
    const interval = cadenceIntervalDays(recurrence);
    let day = Math.ceil((dueAt.getTime() - start.getTime()) / 86_400_000);
    if (day < 1) {
      if (interval <= 0) continue;
      const elapsed = Math.ceil((start.getTime() - dueAt.getTime()) / 86_400_000);
      day += Math.ceil(elapsed / interval) * interval;
      while (day < 1) day += interval;
    }
    while (day <= horizonDays) {
      events.set(day, (events.get(day) ?? 0n) + absolute(obligation.amount.amountMinor));
      if (interval <= 0) break;
      day += interval;
    }
  }
  return events;
}

function absolute(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function parseMinorUnits(value: bigint | number | string, field: string): bigint {
  if (typeof value === "number" && !Number.isSafeInteger(value)) {
    throw new Error(`${field} must be a safe integer when provided as a number`);
  }
  try {
    return BigInt(value);
  } catch {
    throw new Error(`${field} must be an integer amount in minor currency units`);
  }
}

export function forecastCashFlow(input: {
  readonly currency: CurrencyCode;
  readonly startingBalanceMinor: bigint | number | string;
  readonly averageMonthlyIncomeMinor: bigint | number | string;
  readonly averageMonthlyExpenseMinor: bigint | number | string;
  readonly recurring?: readonly RecurringTransaction[];
  readonly obligations?: readonly Obligation[];
  readonly safetyBufferMinor?: bigint | number | string;
  readonly asOf?: string;
  readonly horizonDays?: ForecastHorizonDays;
}): CashForecast {
  const horizonDays = input.horizonDays ?? 90;
  try {
    getCurrencyDefinition(currencyCode(input.currency));
  } catch {
    throw new Error(`Unsupported forecast currency: ${input.currency}`);
  }
  if (horizonDays !== 30 && horizonDays !== 60 && horizonDays !== 90) {
    throw new Error(`Unsupported forecast horizon: ${horizonDays}`);
  }
  const startingBalanceMinor = parseMinorUnits(input.startingBalanceMinor, "Starting balance");
  const averageMonthlyIncomeMinor = parseMinorUnits(input.averageMonthlyIncomeMinor, "Average monthly income");
  const averageMonthlyExpenseMinor = parseMinorUnits(input.averageMonthlyExpenseMinor, "Average monthly expense");
  const safetyBufferMinor = parseMinorUnits(input.safetyBufferMinor ?? 0, "Safety buffer");
  if (averageMonthlyIncomeMinor < 0n || averageMonthlyExpenseMinor < 0n || safetyBufferMinor < 0n) throw new Error("Forecast amounts cannot be negative");

  const start = new Date(input.asOf ?? new Date().toISOString());
  if (Number.isNaN(start.getTime())) throw new Error(`Invalid forecast date: ${input.asOf}`);

  const recurringIncome = recurringEvents(input.recurring ?? [], horizonDays, "income", start, input.currency);
  const recurringExpense = recurringEvents(input.recurring ?? [], horizonDays, "expense", start, input.currency);
  const obligations = obligationEvents(input.obligations ?? [], horizonDays, start, input.currency);
  const points: ForecastPoint[] = [];
  let balance = startingBalanceMinor;
  let projectedIncomeMinor = 0n;
  let projectedExpenseMinor = 0n;
  let minimumProjectedBalanceMinor = startingBalanceMinor;
  let runwayDays: number | null = null;
  let firstShortfallDate: string | undefined;

  for (let day = 1; day <= horizonDays; day += 1) {
    const monthlyBoundary = day % 30 === 1;
    const income = (monthlyBoundary ? averageMonthlyIncomeMinor : 0n) + (recurringIncome.get(day) ?? 0n);
    const expense = (monthlyBoundary ? averageMonthlyExpenseMinor : 0n) + (recurringExpense.get(day) ?? 0n) + (obligations.get(day) ?? 0n)
    balance += income - expense;
    projectedIncomeMinor += income;
    projectedExpenseMinor += expense;
    minimumProjectedBalanceMinor = balance < minimumProjectedBalanceMinor ? balance : minimumProjectedBalanceMinor;
    if (runwayDays === null && balance <= 0n) runwayDays = day;
    const point = { date: addDays(start, day).toISOString(), projectedIncomeMinor: income, projectedExpenseMinor: expense, projectedNetCashFlowMinor: income - expense, projectedBalanceMinor: balance };
    points.push(point);
    if (firstShortfallDate === undefined && balance < safetyBufferMinor) firstShortfallDate = point.date;
  }

  const shortfallMinor = safetyBufferMinor > minimumProjectedBalanceMinor ? safetyBufferMinor - minimumProjectedBalanceMinor : 0n;
  const liquidityRisk: LiquidityRisk = {
    level: minimumProjectedBalanceMinor <= 0n ? "critical" : minimumProjectedBalanceMinor < safetyBufferMinor ? "high" : minimumProjectedBalanceMinor < startingBalanceMinor / 2n ? "watch" : "healthy",
    minimumProjectedBalanceMinor,
    safetyBufferMinor,
    shortfallMinor,
    ...(firstShortfallDate ? { firstShortfallDate } : {}),
  };

  return { currency: input.currency, startingBalanceMinor, horizonDays, projectedIncomeMinor, projectedExpenseMinor, projectedNetCashFlowMinor: projectedIncomeMinor - projectedExpenseMinor, endingBalanceMinor: balance, minimumProjectedBalanceMinor, runwayDays, liquidityRisk, points };
}
