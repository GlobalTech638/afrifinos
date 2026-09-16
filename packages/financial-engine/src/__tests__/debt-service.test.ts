import { describe, expect, it } from "vitest";
import { calculateMonthlyDebtService } from "../metrics.js";

describe("calculateMonthlyDebtService", () => {
  it("normalizes recurring cadences to monthly service", () => {
    expect(calculateMonthlyDebtService([
      { amountMinor: 12_000n, currency: "KES", cadence: "monthly", active: true },
      { amountMinor: 3_000n, currency: "KES", cadence: "quarterly", active: true },
      { amountMinor: 1_200n, currency: "KES", cadence: "annual", active: true },
    ], "KES")).toBe(13_200n);
  });

  it("normalizes weekly and biweekly payments without floating point", () => {
    expect(calculateMonthlyDebtService([
      { amountMinor: 1_200n, currency: "KES", cadence: "weekly", active: true },
      { amountMinor: 2_000n, currency: "KES", cadence: "biweekly", active: true },
    ], "KES")).toBe(8_533n);
  });

  it("ignores inactive, foreign-currency, non-positive and one-off sources", () => {
    expect(calculateMonthlyDebtService([
      { amountMinor: 10_000n, currency: "KES", cadence: "monthly", active: false },
      { amountMinor: 10_000n, currency: "USD", cadence: "monthly", active: true },
      { amountMinor: 10_000n, currency: "KES", cadence: "once", active: true },
      { amountMinor: -1n, currency: "KES", cadence: "monthly", active: true },
    ], "KES")).toBe(0n);
  });

  it("handles very large monetary values as bigint", () => {
    const amount = 10n ** 30n;
    expect(calculateMonthlyDebtService([
      { amountMinor: amount, currency: "KES", cadence: "monthly", active: true },
    ], "KES")).toBe(amount);
  });
});
