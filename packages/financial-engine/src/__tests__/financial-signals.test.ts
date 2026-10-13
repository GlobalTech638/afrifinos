import { describe, expect, it } from "vitest";
import { deriveFinancialSignals } from "../financial-signals.js";
import type { FinancialIntelligenceSnapshot } from "../intelligence-contracts.js";

describe("financial signals", () => {
  it("creates a warning signal for high liquidity risk", () => {
    const snapshot = {
      generatedAt: "2026-10-09T00:00:00Z",
      forecast: { liquidityRisk: { level: "high" } },
      spendingDrivers: [],
    } as unknown as FinancialIntelligenceSnapshot;

    expect(deriveFinancialSignals(snapshot)).toMatchObject([
      { id: "liquidity-high", severity: "warning", status: "active" },
    ]);
  });

  it("only emits spending-driver signals for material increases", () => {
    const snapshot = {
      generatedAt: "2026-10-09T00:00:00Z",
      forecast: { liquidityRisk: { level: "low" } },
      spendingDrivers: [
        { categoryId: "groceries", direction: "increase", contributionRatio: 0.5 },
        { categoryId: "transport", direction: "increase", contributionRatio: 0.25 },
        { categoryId: "utilities", direction: "increase", contributionRatio: 0.249 },
        { categoryId: "rent", direction: "decrease", contributionRatio: 0.8 },
      ],
    } as unknown as FinancialIntelligenceSnapshot;

    expect(deriveFinancialSignals(snapshot)).toMatchObject([
      { id: "spending-driver-groceries", severity: "warning", evidenceIds: ["categoryTrends.groceries"] },
      { id: "spending-driver-transport", severity: "info", evidenceIds: ["categoryTrends.transport"] },
    ]);
  });

  it("creates a critical liquidity signal with stable identity", () => {
    const snapshot = {
      generatedAt: "2026-10-09T00:00:00Z",
      forecast: { liquidityRisk: { level: "critical" } },
      spendingDrivers: [],
    } as unknown as FinancialIntelligenceSnapshot;
    const result = deriveFinancialSignals(snapshot);
    expect(result[0]).toMatchObject({ id: "liquidity-critical", severity: "critical", status: "active", detectedAt: "2026-10-09T00:00:00Z" });
  });
});
