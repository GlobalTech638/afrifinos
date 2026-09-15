import { describe, expect, it } from "vitest";
import { createStructuredAiAnalyst } from "../ai-provider.js";
import type { FinancialIntelligenceSnapshot } from "../intelligence-contracts.js";

const snapshot: FinancialIntelligenceSnapshot = {
  schemaVersion: "2026-09-v1", currency: "KES", generatedAt: "2026-09-15T00:00:00Z",
  summary: {
    currency: "KES", accountBalances: [], liquidBalanceMinor: 1000n,
    cashFlow: { incomeMinor: 1000n, expenseMinor: 500n, netCashFlowMinor: 500n },
    savings: { incomeMinor: 1000n, savingsMinor: 500n, savingsRate: 0.5 },
    debt: { incomeMinor: 1000n, debtServiceMinor: 100n, debtBurdenRatio: 0.1 },
    netWorth: { currency: "KES", assetsMinor: 1000n, liabilitiesMinor: 0n, netWorthMinor: 1000n },
    healthInputs: { savingsRate: 0.5, debtBurdenRatio: 0.1, emergencyRunwayMonths: 2, spendingVolatility: 0.1, goalProgress: 0.5 },
    healthScore: { methodologyVersion: "2026-09-v1", score: 80, band: "strong", components: [] },
  },
  temporal: { currency: "KES", periods: [], recurring: [], anomalies: [] },
  forecast: {
    currency: "KES", startingBalanceMinor: 1000n, horizonDays: 30,
    projectedIncomeMinor: 1000n, projectedExpenseMinor: 500n,
    projectedNetCashFlowMinor: 500n, endingBalanceMinor: 1500n,
    minimumProjectedBalanceMinor: 1000n, runwayDays: null, points: [],
  },
  facts: [{ id: "cash-ok", category: "cash_flow", statement: "Cash flow is positive.", severity: "info" }],
};

describe("createStructuredAiAnalyst", () => {
  it("passes a provider-neutral prompt and validates its response", async () => {
    let receivedUserPrompt = "";
    const analyst = createStructuredAiAnalyst({
      name: "test-provider",
      async complete(prompt) {
        receivedUserPrompt = prompt.user;
        return {
          schemaVersion: "2026-09-v1", generatedAt: "2026-09-15T00:02:00Z",
          advice: [{
            id: "a1", priority: "low", riskLevel: "low", title: "Keep monitoring",
            explanation: "Cash flow is positive.", evidenceIds: ["cash-ok"], action: "Continue monitoring.",
          }],
        };
      },
    });

    const result = await analyst.analyze(snapshot);
    expect(analyst.provider).toBe("test-provider");
    expect(result.advice).toHaveLength(1);
    expect(receivedUserPrompt).toContain("2026-09-v1");
    expect(receivedUserPrompt).toContain("1000");
  });

  it("does not trust invalid provider output", async () => {
    const analyst = createStructuredAiAnalyst({
      name: "bad-provider",
      async complete() {
        return { schemaVersion: "2026-09-v1", generatedAt: "2026-09-15T00:02:00Z", advice: [{
          id: "a1", priority: "high", riskLevel: "high", title: "Unsupported",
          explanation: "Made up.", evidenceIds: ["not-real"], action: "Act.",
        }] };
      },
    });

    await expect(analyst.analyze(snapshot)).rejects.toThrow("unknown evidence ID");
  });
});
