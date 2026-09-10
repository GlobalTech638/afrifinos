export type CurrencyCode = string & { readonly __brand: "CurrencyCode" };

export interface CurrencyDefinition {
  readonly code: CurrencyCode;
  readonly name: string;
  /** Number of decimal places represented by one major currency unit. */
  readonly minorUnitExponent: number;
}

const DEFINITIONS: Record<string, CurrencyDefinition> = {
  KES: { code: "KES" as CurrencyCode, name: "Kenyan Shilling", minorUnitExponent: 2 },
  UGX: { code: "UGX" as CurrencyCode, name: "Ugandan Shilling", minorUnitExponent: 0 },
  TZS: { code: "TZS" as CurrencyCode, name: "Tanzanian Shilling", minorUnitExponent: 2 },
  NGN: { code: "NGN" as CurrencyCode, name: "Nigerian Naira", minorUnitExponent: 2 },
  GHS: { code: "GHS" as CurrencyCode, name: "Ghanaian Cedi", minorUnitExponent: 2 },
  ZAR: { code: "ZAR" as CurrencyCode, name: "South African Rand", minorUnitExponent: 2 },
  USD: { code: "USD" as CurrencyCode, name: "US Dollar", minorUnitExponent: 2 },
  EUR: { code: "EUR" as CurrencyCode, name: "Euro", minorUnitExponent: 2 }
};

export function currencyCode(value: string): CurrencyCode {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new Error(`Invalid ISO 4217 currency code: ${value}`);
  }
  return normalized as CurrencyCode;
}

export function getCurrencyDefinition(code: CurrencyCode): CurrencyDefinition {
  const definition = DEFINITIONS[code];
  if (!definition) {
    throw new Error(`Unsupported currency: ${code}`);
  }
  return definition;
}
