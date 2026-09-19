import { describe, expect, it } from "vitest";
import { deriveFinancialSignals } from "../intelligence-contracts.js";

describe("financial signals", () => {
  it("turns warning and critical facts into active signals", () => {
    const result = deriveFinancialSignals([
      { id: "cash-1", category: "cash_flow", statement: "Negative cash flow", severity: "warning", evidence: ["summary.cashFlow"] },
      { id: "liquidity-1", category: "forecast", statement: "Liquidity shortfall", severity: "critical", evidence: ["forecast.liquidityRisk"] },
    ], "2026-09-19T00:00:00Z");
    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({ id: "signal-liquidity-1", status: "active", severity: "critical" });
  });
});
