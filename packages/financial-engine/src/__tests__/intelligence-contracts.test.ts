import { describe, expect, it } from "vitest";
import { createFinancialIntelligenceSnapshot, INTELLIGENCE_SCHEMA_VERSION } from "../intelligence-contracts.js";

function minimalSummary() {
  return {
    currency: "KES" as const,
    accountBalances: [],
    liquidBalanceMinor: 100000n,
    cashFlow: { incomeMinor: 100000n, expenseMinor: 50000n, netCashFlowMinor: 50000n },
    savings: { incomeMinor: 100000n, savingsMinor: 50000n, savingsRate: 0.5 },
    debt: { debtServiceMinor: 10000n, incomeMinor: 100000n, debtBurdenRatio: 0.1 },
    netWorth: { currency: "KES" as const, assetsMinor: 100000n, liabilitiesMinor: 0n, netWorthMinor: 100000n },
    healthInputs: {
      savingsRate: 0.5,
      debtBurdenRatio: 0.1,
      emergencyRunwayMonths: 2,
      spendingVolatility: 0.2,
      goalProgress: 0.4,
    },
    healthScore: {
      methodologyVersion: "2026-09-v1",
      score: 70,
      band: "stable" as const,
      components: [],
    },
  };
}

describe("financial intelligence contracts", () => {
  it("creates a versioned snapshot with consistent currency", () => {
    const snapshot = createFinancialIntelligenceSnapshot({
      summary: minimalSummary(),
      temporal: { currency: "KES", periods: [], recurring: [], anomalies: [] },
      forecast: {
        currency: "KES",
        startingBalanceMinor: 100000n,
        horizonDays: 30,
        projectedIncomeMinor: 100000n,
        projectedExpenseMinor: 50000n,
        projectedNetCashFlowMinor: 50000n,
        endingBalanceMinor: 150000n,
        minimumProjectedBalanceMinor: 101000n,
        runwayDays: null,
        points: [],
      },
      generatedAt: "2026-09-14T18:00:00Z",
    });

    expect(snapshot.schemaVersion).toBe(INTELLIGENCE_SCHEMA_VERSION);
    expect(snapshot.currency).toBe("KES");
    expect(snapshot.facts).toEqual([]);
  });

  it("rejects currency mismatches at the AI boundary", () => {
    expect(() => createFinancialIntelligenceSnapshot({
      summary: minimalSummary(),
      temporal: { currency: "USD", periods: [], recurring: [], anomalies: [] },
      forecast: {
        currency: "KES",
        startingBalanceMinor: 0n,
        horizonDays: 30,
        projectedIncomeMinor: 0n,
        projectedExpenseMinor: 0n,
        projectedNetCashFlowMinor: 0n,
        endingBalanceMinor: 0n,
        minimumProjectedBalanceMinor: 0n,
        runwayDays: null,
        points: [],
      },
    })).toThrow("currency mismatch");
  });
});
