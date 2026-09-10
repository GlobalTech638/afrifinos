import type { CurrencyCode } from "./currency.js";

/**
 * Exact monetary value represented in minor units.
 * Example: KES 1,250.50 is amountMinor=125050 and currency=KES.
 */
export interface Money {
  readonly amountMinor: bigint;
  readonly currency: CurrencyCode;
}

export function money(amountMinor: bigint | number | string, currency: CurrencyCode): Money {
  return { amountMinor: BigInt(amountMinor), currency };
}

export function addMoney(left: Money, right: Money): Money {
  assertSameCurrency(left, right);
  return { currency: left.currency, amountMinor: left.amountMinor + right.amountMinor };
}

export function subtractMoney(left: Money, right: Money): Money {
  assertSameCurrency(left, right);
  return { currency: left.currency, amountMinor: left.amountMinor - right.amountMinor };
}

export function negateMoney(value: Money): Money {
  return { currency: value.currency, amountMinor: -value.amountMinor };
}

export function assertSameCurrency(left: Money, right: Money): void {
  if (left.currency !== right.currency) {
    throw new Error(`Currency mismatch: ${left.currency} != ${right.currency}`);
  }
}
