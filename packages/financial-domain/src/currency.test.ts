import { describe, expect, it } from "vitest";
import { currencyCode, getCurrencyDefinition } from "./currency.js";

describe("currency definitions", () => {
  it("normalizes currency codes without silently accepting malformed values", () => {
    expect(currencyCode(" kes ")).toBe("KES");
    expect(() => currencyCode("KE")).toThrow("Invalid ISO 4217 currency code");
    expect(() => currencyCode("K3S")).toThrow("Invalid ISO 4217 currency code");
  });

  it("supports currencies used across multiple African regions", () => {
    for (const code of ["KES", "UGX", "TZS", "RWF", "ETB", "NGN", "GHS", "XOF", "XAF", "ZAR", "MAD", "EGP", "MZN", "ZMW"]) {
      expect(getCurrencyDefinition(currencyCode(code)).code).toBe(code);
    }
  });

  it("preserves currency-specific minor-unit exponents", () => {
    expect(getCurrencyDefinition(currencyCode("KES")).minorUnitExponent).toBe(2);
    expect(getCurrencyDefinition(currencyCode("UGX")).minorUnitExponent).toBe(0);
    expect(getCurrencyDefinition(currencyCode("XOF")).minorUnitExponent).toBe(0);
    expect(getCurrencyDefinition(currencyCode("TND")).minorUnitExponent).toBe(3);
  });

  it("rejects well-formed but unsupported currency codes", () => {
    expect(() => getCurrencyDefinition(currencyCode("ZZZ"))).toThrow("Unsupported currency: ZZZ");
  });
});
