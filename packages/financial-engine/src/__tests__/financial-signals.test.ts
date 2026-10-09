import { describe, expect, it } from "vitest";
import { deriveFinancialSignals } from "../financial-signals.js";
import type { FinancialIntelligenceSnapshot } from "../intelligence-contracts.js";

describe("financial signals", () => {
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
