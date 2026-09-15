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
