import { describe, expect, it } from "vitest";
import { calculateEmergencyRunway, calculateGoalProgress, calculateSpendingVolatility } from "../resilience.js";
import type { Transaction } from "@afrifinos/financial-domain";

function transaction(id: string, occurredAt: string, amountMinor: bigint): Transaction {
  return {
    transactionId: id,
    ownerId: "owner-1",
    type: "expense",
    status: "posted",
    occurredAt,
    total: { amountMinor, currency: "KES" },
    provenance: { sourceKind: "manual", importedAt: occurredAt },
  };
}

describe("resilience metrics", () => {
  it("calculates emergency runway in months", () => {
    expect(calculateEmergencyRunway(300_000n, 100_000n).months).toBe(3);
  });

  it("returns null runway when expenses are zero", () => {
    expect(calculateEmergencyRunway(300_000n, 0n).months).toBeNull();
  });

  it("detects higher volatility across monthly spending", () => {
    const result = calculateSpendingVolatility([
      transaction("1", "2026-01-10T00:00:00.000Z", 100_000n),
      transaction("2", "2026-02-10T00:00:00.000Z", 200_000n),
    ], "KES");
    expect(result.monthlyExpenseCoefficient).toBeCloseTo(1 / 3, 5);
    expect(result.normalizedVolatility).toBeCloseTo(1 / 3, 5);
  });

  it("requires at least two months for volatility", () => {
    expect(calculateSpendingVolatility([
      transaction("1", "2026-01-10T00:00:00.000Z", 100_000n),
    ], "KES").normalizedVolatility).toBeNull();
  });

  it("calculates average progress across active and completed goals", () => {
    const result = calculateGoalProgress([
      { current: { amountMinor: 50_000n }, target: { amountMinor: 100_000n }, status: "active" },
      { current: { amountMinor: 100_000n }, target: { amountMinor: 100_000n }, status: "completed" },
      { current: { amountMinor: 90_000n }, target: { amountMinor: 100_000n }, status: "cancelled" },
    ]);
    expect(result.activeGoals).toBe(2);
    expect(result.weightedProgress).toBe(0.75);
  });
});
