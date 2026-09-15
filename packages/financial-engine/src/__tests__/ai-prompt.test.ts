import { describe, expect, it } from "vitest";
import { buildAiAnalystPrompt } from "../ai-prompt.js";
import type { FinancialIntelligenceSnapshot } from "../intelligence-contracts.js";

describe("buildAiAnalystPrompt", () => {
  it("serializes bigint financial values without losing precision", () => {
    const snapshot = {
      schemaVersion: "2026-09-v1",
      currency: "KES",
      generatedAt: "2026-09-15T00:00:00Z",
      summary: {
        currency: "KES",
        accountBalances: [],
        liquidBalanceMinor: 900719925474099312345n,
        cashFlow: { incomeMinor: 0n, expenseMinor: 0n, netCashFlowMinor: 0n },
        savings: { incomeMinor: 0n, savingsMinor: 0n, savingsRate: null },
        debt: { incomeMinor: 0n, debtServiceMinor: 0n, debtBurdenRatio: null },
        netWorth: { currency: "KES", assetsMinor: 0n, liabilitiesMinor: 0n, netWorthMinor: 0n },
        healthInputs: { savingsRate: null, debtBurdenRatio: null, emergencyRunwayMonths: null, spendingVolatility: null, goalProgress: null },
        healthScore: { methodologyVersion: "2026-09-v1", score: 50, band: "fragile", components: [] },
      },
      temporal: { currency: "KES", periods: [], recurring: [], anomalies: [] },
      forecast: {
        currency: "KES", startingBalanceMinor: 0n, horizonDays: 30,
        projectedIncomeMinor: 0n, projectedExpenseMinor: 0n, projectedNetCashFlowMinor: 0n,
        endingBalanceMinor: 0n, minimumProjectedBalanceMinor: 0n, runwayDays: null, points: [],
      },
      facts: [],
    } satisfies FinancialIntelligenceSnapshot;

    const prompt = buildAiAnalystPrompt(snapshot);
    expect(prompt.schemaVersion).toBe("2026-09-v1");
    expect(prompt.user).toContain("900719925474099312345");
    expect(prompt.user).toContain("Produce structured financial advice only");
  });
});
