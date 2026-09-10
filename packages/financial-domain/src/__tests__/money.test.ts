import { describe, expect, it } from "vitest";
import { addMoney, currencyCode, money } from "../index.js";

describe("Money", () => {
  it("keeps monetary arithmetic exact with bigint minor units", () => {
    const a = money("10000000000000000001", currencyCode("KES"));
    const b = money("2", currencyCode("KES"));

    expect(addMoney(a, b).amountMinor).toBe(10000000000000000003n);
  });

  it("rejects arithmetic across currencies", () => {
    const kes = money(100, currencyCode("KES"));
    const usd = money(100, currencyCode("USD"));

    expect(() => addMoney(kes, usd)).toThrow(/Currency mismatch/);
  });
});
