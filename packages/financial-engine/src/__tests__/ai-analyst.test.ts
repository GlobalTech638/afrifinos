import { describe, expect, it } from "vitest";
import { createRuleBasedAnalyst, deriveFinancialFacts } from "../ai-analyst.js";
import type { FinancialIntelligenceSnapshot } from "../intelligence-contracts.js";

const snapshot: FinancialIntelligenceSnapshot = {
  schemaVersion: "2026-09-v1",
  currency: "KES",
  generatedAt: "2026-09-15T00:00:00Z",
  summary: {
    currency: "KES",
    accountBalances: [],
    liquidBalanceMinor: 10000n,
    cashFlow: { incomeMinor: 100000n, expenseMinor: 130000n, netCashFlowMinor: -30000n },
    savings: { incomeMinor: 100000n, savingsMinor: -30000n, savingsRate: -0.3 },
    debt: { incomeMinor: 100000n, debtServiceMinor: 50000n, debtBurdenRatio: 0.5 },
    netWorth: { currency: "KES", assetsMinor: 10000n, liabilitiesMinor: 100000n, netWorthMinor: -90000n },
    healthInputs: { savingsRate: -0.3, debtBurdenRatio: 0.5, emergencyRunwayMonths: 0.2, spendingVolatility: 0.4, goalProgress: 0 },
    healthScore: { methodologyVersion: "2026-09-v1", score: 20, band: "critical", components: [] },
  },
  temporal: {
    currency: "KES",
    periods: [],
    recurring: [],
    anomalies: [],
  },
  forecast: {
    currency: "KES",
    startingBalanceMinor: 10000n,
    horizonDays: 30,
    projectedIncomeMinor: 0n,
    projectedExpenseMinor: 30000n,
    projectedNetCashFlowMinor: -30000n,
    endingBalanceMinor: -20000n,
    minimumProjectedBalanceMinor: -20000n,
    runwayDays: 10,
    points: [],
  },
  facts: [],
};

describe("ai analyst", () => {
  it("derives explainable facts from deterministic intelligence", () => {
    const facts = deriveFinancialFacts(snapshot);
    expect(facts.map((item) => item.id)).toEqual([
      "savings-negative",
      "debt-high-burden",
      "forecast-negative-balance",
    ]);
  });

  it("returns structured advice tied to fact IDs", async () => {
    const result = await createRuleBasedAnalyst().analyze(snapshot);
    expect(result.schemaVersion).toBe("2026-09-v1");
    expect(result.advice).toHaveLength(3);
    expect(result.advice.every((item) => item.evidenceIds.length > 0)).toBe(true);
  });
});
