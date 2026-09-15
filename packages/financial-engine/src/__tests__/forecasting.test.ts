import { describe, expect, it } from "vitest";
import { forecastCashFlow } from "../forecasting.js";
import type { RecurringTransaction } from "../temporal-intelligence.js";

const recurring: readonly RecurringTransaction[] = [
  {
    key: "income:salary:KES",
    description: "Salary",
    type: "income",
    currency: "KES",
    amountMinor: 100000n,
    averageAmountMinor: 100000n,
    occurrenceCount: 3,
    averageIntervalDays: 30,
    cadence: "monthly",
    confidence: 0.95,
    lastObservedAt: "2026-08-25T00:00:00Z",
  },
  {
    key: "expense:rent:KES",
    description: "Rent",
    type: "expense",
    currency: "KES",
    amountMinor: 30000n,
    averageAmountMinor: 30000n,
    occurrenceCount: 3,
    averageIntervalDays: 30,
    cadence: "monthly",
    confidence: 0.95,
    lastObservedAt: "2026-08-25T00:00:00Z",
  },
];

describe("forecastCashFlow", () => {
  it("adds recurring transactions as discrete events on top of the baseline", () => {
    const forecast = forecastCashFlow({
      currency: "KES",
      startingBalanceMinor: 50000n,
      averageMonthlyIncomeMinor: 0n,
      averageMonthlyExpenseMinor: 0n,
      recurring,
      asOf: "2026-09-01T00:00:00Z",
      horizonDays: 30,
    });

    expect(forecast.projectedIncomeMinor).toBe(100000n);
    expect(forecast.projectedExpenseMinor).toBe(30000n);
    expect(forecast.projectedNetCashFlowMinor).toBe(70000n);
    expect(forecast.endingBalanceMinor).toBe(120000n);
    expect(forecast.minimumProjectedBalanceMinor).toBe(50000n);
    expect(forecast.runwayDays).toBeNull();
    expect(forecast.points[29]?.projectedBalanceMinor).toBe(120000n);
  });

  it("schedules the next recurring occurrence relative to the last observed transaction", () => {
    const forecast = forecastCashFlow({
      currency: "KES",
      startingBalanceMinor: 0n,
      averageMonthlyIncomeMinor: 0n,
      averageMonthlyExpenseMinor: 0n,
      recurring: [recurring[0]!],
      asOf: "2026-09-01T00:00:00Z",
      horizonDays: 30,
    });

    expect(forecast.points[23]?.projectedIncomeMinor).toBe(100000n);
    expect(forecast.points[29]?.projectedIncomeMinor).toBe(0n);
  });

  it("includes active one-off obligations on their due date", () => {
    const forecast = forecastCashFlow({
      currency: "KES",
      startingBalanceMinor: 50000n,
      averageMonthlyIncomeMinor: 0n,
      averageMonthlyExpenseMinor: 0n,
      obligations: [{
        obligationId: "school-fees",
        ownerId: "user-1",
        name: "School fees",
        amount: { amountMinor: 40000n, currency: "KES" },
        dueAt: "2026-09-11T00:00:00Z",
        status: "active",
        recurring: false,
      }],
      asOf: "2026-09-01T00:00:00Z",
      horizonDays: 30,
    });

    expect(forecast.points[9]?.projectedExpenseMinor).toBe(40000n);
    expect(forecast.endingBalanceMinor).toBe(10000n);
  });

  it("projects recurring obligations every 30 days", () => {
    const forecast = forecastCashFlow({
      currency: "KES",
      startingBalanceMinor: 100000n,
      averageMonthlyIncomeMinor: 0n,
      averageMonthlyExpenseMinor: 0n,
      obligations: [{
        obligationId: "rent-obligation",
        ownerId: "user-1",
        name: "Rent",
        amount: { amountMinor: 30000n, currency: "KES" },
        dueAt: "2026-09-05T00:00:00Z",
        status: "active",
        recurring: true,
      }],
      asOf: "2026-09-01T00:00:00Z",
      horizonDays: 90,
    });

    expect(forecast.points[3]?.projectedExpenseMinor).toBe(30000n);
    expect(forecast.points[33]?.projectedExpenseMinor).toBe(30000n);
    expect(forecast.points[63]?.projectedExpenseMinor).toBe(30000n);
    expect(forecast.endingBalanceMinor).toBe(10000n);
  });

  it("ignores settled, cancelled, and foreign-currency obligations", () => {
    const forecast = forecastCashFlow({
      currency: "KES",
      startingBalanceMinor: 100000n,
      averageMonthlyIncomeMinor: 0n,
      averageMonthlyExpenseMinor: 0n,
      obligations: [
        {
          obligationId: "settled",
          ownerId: "user-1",
          name: "Settled",
          amount: { amountMinor: 10000n, currency: "KES" },
          dueAt: "2026-09-05T00:00:00Z",
          status: "settled",
          recurring: false,
        },
        {
          obligationId: "cancelled",
          ownerId: "user-1",
          name: "Cancelled",
          amount: { amountMinor: 10000n, currency: "KES" },
          dueAt: "2026-09-05T00:00:00Z",
          status: "cancelled",
          recurring: false,
        },
        {
          obligationId: "foreign",
          ownerId: "user-1",
          name: "Foreign",
          amount: { amountMinor: 10000n, currency: "USD" },
          dueAt: "2026-09-05T00:00:00Z",
          status: "active",
          recurring: false,
        },
      ],
      asOf: "2026-09-01T00:00:00Z",
      horizonDays: 30,
    });

    expect(forecast.projectedExpenseMinor).toBe(0n);
    expect(forecast.endingBalanceMinor).toBe(100000n);
  });

  it("keeps the historical baseline separate from recurring events", () => {
    const forecast = forecastCashFlow({
      currency: "KES",
      startingBalanceMinor: 50000n,
      averageMonthlyIncomeMinor: 90000n,
      averageMonthlyExpenseMinor: 60000n,
      recurring,
      asOf: "2026-09-01T00:00:00Z",
      horizonDays: 30,
    });

    expect(forecast.projectedIncomeMinor).toBe(190000n);
    expect(forecast.projectedExpenseMinor).toBe(90000n);
    expect(forecast.endingBalanceMinor).toBe(150000n);
  });

  it("preserves exact monthly baseline totals without floating-point rounding drift", () => {
    const forecast = forecastCashFlow({
      currency: "KES",
      startingBalanceMinor: 0n,
      averageMonthlyIncomeMinor: 100n,
      averageMonthlyExpenseMinor: 0n,
      asOf: "2026-09-01T00:00:00Z",
      horizonDays: 90,
    });

    expect(forecast.projectedIncomeMinor).toBe(300n);
  });

  it("reports the first day on which cash is exhausted", () => {
    const forecast = forecastCashFlow({
      currency: "KES",
      startingBalanceMinor: 10000n,
      averageMonthlyIncomeMinor: 0n,
      averageMonthlyExpenseMinor: 30000n,
      asOf: "2026-09-01T00:00:00Z",
      horizonDays: 30,
    });

    expect(forecast.runwayDays).toBe(1);
    expect(forecast.endingBalanceMinor).toBe(-20000n);
  });

  it("keeps positive cash flow runway open", () => {
    const forecast = forecastCashFlow({
      currency: "KES",
      startingBalanceMinor: 100000n,
      averageMonthlyIncomeMinor: 50000n,
      averageMonthlyExpenseMinor: 20000n,
      horizonDays: 60,
    });

    expect(forecast.runwayDays).toBeNull();
    expect(forecast.endingBalanceMinor).toBe(160000n);
  });
});
