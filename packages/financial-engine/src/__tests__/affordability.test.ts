import { describe, expect, it } from "vitest";
import { assessAffordability } from "../affordability.js";
import type { CashForecast } from "../forecasting.js";

function forecast(minimum: bigint, ending: bigint, buffer: bigint): CashForecast {
  return {
    currency: "KES",
    startingBalanceMinor: 100_000n,
    horizonDays: 90,
    projectedIncomeMinor: 300_000n,
    projectedExpenseMinor: 200_000n,
    projectedNetCashFlowMinor: 100_000n,
    endingBalanceMinor: ending,
    minimumProjectedBalanceMinor: minimum,
    runwayDays: null,
    liquidityRisk: {
      level: "healthy",
      minimumProjectedBalanceMinor: minimum,
      safetyBufferMinor: buffer,
      shortfallMinor: 0n,
    },
    points: Array.from({ length: 90 }, (_, index) => ({\n      date: new Date(Date.UTC(2026, 0, 2 + index)).toISOString(),\n      projectedIncomeMinor: 0n,\n      projectedExpenseMinor: 0n,\n      projectedNetCashFlowMinor: 0n,\n      projectedBalanceMinor: ending,\n    })),
  };
}

describe("assessAffordability", () => {
  it("marks a purchase affordable when projected liquidity stays above the buffer", () => {
    const result = assessAffordability({
      currency: "KES",
      purchaseAmountMinor: 10_000n,
      forecast: forecast(100_000n, 200_000n, 50_000n),
    });
    expect(result.decision).toBe("affordable");
    expect(result.projectedMinimumBalanceMinor).toBe(90_000n);
  });

  it("returns caution when the purchase crosses the safety buffer", () => {
    const result = assessAffordability({
      currency: "KES",
      purchaseAmountMinor: 60_000n,
      forecast: forecast(100_000n, 200_000n, 50_000n),
    });
    expect(result.decision).toBe("caution");
    expect(result.bufferShortfallMinor).toBe(10_000n);
  });

  it("returns not_affordable when the purchase exhausts projected liquidity", () => {
    const result = assessAffordability({
      currency: "KES",
      purchaseAmountMinor: 110_000n,
      forecast: forecast(100_000n, 200_000n, 50_000n),
    });
    expect(result.decision).toBe("not_affordable");
  });

  it("includes additional recurring monthly cost", () => {
    const result = assessAffordability({
      currency: "KES",
      purchaseAmountMinor: 20_000n,
      additionalRecurringMonthlyMinor: 40_000n,
      forecast: forecast(100_000n, 200_000n, 50_000n),
    });
    expect(result.projectedMinimumBalanceMinor).toBe(40_000n);
    expect(result.decision).toBe("caution");
  });

  it("preserves large monetary values as bigint", () => {
    const amount = 10n ** 30n;
    const result = assessAffordability({
      currency: "KES",
      purchaseAmountMinor: amount,
      forecast: forecast(amount * 2n, amount * 3n, amount),
    });
    expect(result.projectedMinimumBalanceMinor).toBe(amount);
  });
});
