import { describe, expect, it } from "vitest";
import { calculateSpendingDrivers } from "../trend-intelligence.js";

describe("spending drivers", () => {
  it("attributes the magnitude of category change", () => {
    const result = calculateSpendingDrivers([
      { categoryId: "transport", currentMinor: 20000n, baselineMinor: 10000n, changeMinor: 10000n, changeRatio: 1, direction: "up" },
      { categoryId: "food", currentMinor: 7000n, baselineMinor: 10000n, changeMinor: -3000n, changeRatio: -0.3, direction: "down" },
    ]);
    expect(result[0]?.categoryId).toBe("transport");
    expect(result[0]?.contributionRatio).toBeCloseTo(10 / 13);
    expect(result[1]?.direction).toBe("decrease");
  });
});
