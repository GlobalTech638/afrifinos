import { describe, expect, it } from "vitest";
import { forecastCashFlow } from "../forecasting.js";
import type { RecurringTransaction } from "../temporal-intelligence.js";

const recurring: readonly RecurringTransaction[] = [
  {
    key: "income:salary:KES",
    type: "income",
    currency: "KES",
    amountMinor: 100000n,
    occurrenceCount: 3,
    averageIntervalDays: 30,
    confidence: 0.95,
  },
  {
    key: "expense:rent:KES",
    type: "expense",
    currency: "KES",
    amountMinor: 30000n,
    occurrenceCount: 3,
    averageIntervalDays: 30,
    confidence: 0.95,
  },
];

describe("forecastCashFlow", () => {
  it("projects recurring income and expenses", () => {
    const forecast = forecastCashFlow({
      currency: "KES",
      startingBalanceMinor: 50000n,
      averageMonthlyIncomeMinor: 90000n,
      averageMonthlyExpenseMinor: 60000n,
      recurring,
      asOf: "2026-09-01T00:00:00Z",
      horizonDays: 30,
    });

    expect(forecast.projectedIncomeMinor).toBe(100000n);
    expect(forecast.projectedExpenseMinor).toBe(60000n);
    expect(forecast.projectedNetCashFlowMinor).toBe(40000n);
    expect(forecast.endingBalanceMinor).toBe(90000n);
    expect(forecast.minimumProjectedBalanceMinor).toBe(90000n);
    expect(forecast.runwayDays).toBeNull();
    expect(forecast.points).toHaveLength(30);
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
