import { describe, expect, it } from "vitest";
import {
  buildTemporalIntelligence,
  calculateMonthlyForecastBaseline,
  detectRecurringTransactions,
  detectSpendingAnomalies,
} from "../temporal-intelligence.js";
import type { Transaction } from "@afrifinos/financial-domain";

function transaction(
  transactionId: string,
  occurredAt: string,
  type: "income" | "expense",
  amountMinor: bigint,
  description: string,
  categoryId = "food",
): Transaction {
  return {
    transactionId,
    ownerId: "user-1",
    type,
    status: "posted",
    occurredAt,
    description,
    categoryId,
    total: { amountMinor, currency: "KES" },
    provenance: { sourceKind: "manual", importedAt: occurredAt },
  };
}

describe("temporal intelligence", () => {
  it("aggregates monthly cash flow without counting transfers", () => {
    const result = buildTemporalIntelligence([
      transaction("salary-1", "2026-01-05T08:00:00Z", "income", 200000n, "Salary"),
      transaction("food-1", "2026-01-10T08:00:00Z", "expense", 50000n, "Groceries"),
    ], "KES");

    expect(result.periods).toEqual([{
      period: "2026-01",
      incomeMinor: 200000n,
      expenseMinor: 50000n,
      netCashFlowMinor: 150000n,
      transactionCount: 2,
    }]);
  });

  it("calculates averages from observed monthly periods instead of total history", () => {
    const result = calculateMonthlyForecastBaseline([
      { period: "2026-01", incomeMinor: 100000n, expenseMinor: 50000n, netCashFlowMinor: 50000n, transactionCount: 2 },
      { period: "2026-02", incomeMinor: 200000n, expenseMinor: 100000n, netCashFlowMinor: 100000n, transactionCount: 2 },
    ]);

    expect(result.monthsObserved).toBe(2);
    expect(result.averageMonthlyIncomeMinor).toBe(150000n);
    expect(result.averageMonthlyExpenseMinor).toBe(75000n);
  });

  it("returns zero baselines when there is no observed history", () => {
    expect(calculateMonthlyForecastBaseline([])).toEqual({
      monthsObserved: 0,
      averageMonthlyIncomeMinor: 0n,
      averageMonthlyExpenseMinor: 0n,
    });
  });

  it("detects approximately monthly recurring expenses", () => {
    const transactions = [
      transaction("r1", "2026-01-05T08:00:00Z", "expense", 30000n, "Rent", "rent"),
      transaction("r2", "2026-02-05T08:00:00Z", "expense", 30000n, "Rent", "rent"),
      transaction("r3", "2026-03-06T08:00:00Z", "expense", 30000n, "Rent", "rent"),
    ];

    const result = detectRecurringTransactions(transactions, "KES");
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("expense");
    expect(result[0].amountMinor).toBe(30000n);
    expect(result[0].averageAmountMinor).toBe(30000n);
    expect(result[0].cadence).toBe("monthly");
    expect(result[0].description).toBe("Rent");
  });

  it("detects weekly recurring expenses", () => {
    const transactions = [
      transaction("w1", "2026-09-01T08:00:00Z", "expense", 5000n, "Internet", "utilities"),
      transaction("w2", "2026-09-08T08:00:00Z", "expense", 5000n, "Internet", "utilities"),
      transaction("w3", "2026-09-15T08:00:00Z", "expense", 5000n, "Internet", "utilities"),
    ];

    const result = detectRecurringTransactions(transactions, "KES");
    expect(result).toHaveLength(1);
    expect(result[0].cadence).toBe("weekly");
    expect(result[0].averageIntervalDays).toBe(7);
  });

  it("rejects recurring candidates with unstable amounts", () => {
    const transactions = [
      transaction("u1", "2026-01-05T08:00:00Z", "expense", 10000n, "Subscription", "utilities"),
      transaction("u2", "2026-02-05T08:00:00Z", "expense", 30000n, "Subscription", "utilities"),
      transaction("u3", "2026-03-06T08:00:00Z", "expense", 10000n, "Subscription", "utilities"),
    ];

    expect(detectRecurringTransactions(transactions, "KES")).toHaveLength(0);
  });

  it("flags unusually large spending within a category", () => {
    const transactions = [
      transaction("a1", "2026-01-01T08:00:00Z", "expense", 1000n, "Lunch"),
      transaction("a2", "2026-01-02T08:00:00Z", "expense", 1100n, "Lunch"),
      transaction("a3", "2026-01-03T08:00:00Z", "expense", 900n, "Lunch"),
      transaction("a4", "2026-01-04T08:00:00Z", "expense", 1050n, "Lunch"),
      transaction("a5", "2026-01-05T08:00:00Z", "expense", 10000n, "Lunch"),
    ];

    const result = detectSpendingAnomalies(transactions, "KES");
    expect(result).toHaveLength(1);
    expect(result[0].transactionId).toBe("a5");
    expect(result[0].zScore).toBeGreaterThan(2);
  });
});
