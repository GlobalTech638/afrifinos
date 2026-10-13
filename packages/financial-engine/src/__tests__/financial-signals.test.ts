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

  it("selects eligible spending drivers before applying the five-signal limit", () => {
    const snapshot = {
      generatedAt: "2026-10-09T00:00:00Z",
      forecast: { liquidityRisk: { level: "low" } },
      spendingDrivers: [
        { categoryId: "decrease-1", direction: "decrease", contributionRatio: 0.9 },
        { categoryId: "small-1", direction: "increase", contributionRatio: 0.1 },
        { categoryId: "eligible-1", direction: "increase", contributionRatio: 0.3 },
        { categoryId: "eligible-2", direction: "increase", contributionRatio: 0.4 },
        { categoryId: "eligible-3", direction: "increase", contributionRatio: 0.5 },
        { categoryId: "eligible-4", direction: "increase", contributionRatio: 0.6 },
        { categoryId: "eligible-5", direction: "increase", contributionRatio: 0.7 },
        { categoryId: "eligible-6", direction: "increase", contributionRatio: 0.8 },
      ],
    } as unknown as FinancialIntelligenceSnapshot;

    expect(deriveFinancialSignals(snapshot).map((signal) => signal.id)).toEqual([
      "spending-driver-eligible-1",
      "spending-driver-eligible-2",
      "spending-driver-eligible-3",
      "spending-driver-eligible-4",
      "spending-driver-eligible-5",
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
