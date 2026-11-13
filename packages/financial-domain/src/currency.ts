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
  RWF: { code: "RWF" as CurrencyCode, name: "Rwandan Franc", minorUnitExponent: 0 },
  BIF: { code: "BIF" as CurrencyCode, name: "Burundian Franc", minorUnitExponent: 0 },
  ETB: { code: "ETB" as CurrencyCode, name: "Ethiopian Birr", minorUnitExponent: 2 },
  NGN: { code: "NGN" as CurrencyCode, name: "Nigerian Naira", minorUnitExponent: 2 },
  GHS: { code: "GHS" as CurrencyCode, name: "Ghanaian Cedi", minorUnitExponent: 2 },
  XOF: { code: "XOF" as CurrencyCode, name: "West African CFA Franc", minorUnitExponent: 0 },
  XAF: { code: "XAF" as CurrencyCode, name: "Central African CFA Franc", minorUnitExponent: 0 },
  ZAR: { code: "ZAR" as CurrencyCode, name: "South African Rand", minorUnitExponent: 2 },
  BWP: { code: "BWP" as CurrencyCode, name: "Botswana Pula", minorUnitExponent: 2 },
  NAD: { code: "NAD" as CurrencyCode, name: "Namibian Dollar", minorUnitExponent: 2 },
  LSL: { code: "LSL" as CurrencyCode, name: "Lesotho Loti", minorUnitExponent: 2 },
  SZL: { code: "SZL" as CurrencyCode, name: "Eswatini Lilangeni", minorUnitExponent: 2 },
  ZMW: { code: "ZMW" as CurrencyCode, name: "Zambian Kwacha", minorUnitExponent: 2 },
  MWK: { code: "MWK" as CurrencyCode, name: "Malawian Kwacha", minorUnitExponent: 2 },
  MZN: { code: "MZN" as CurrencyCode, name: "Mozambican Metical", minorUnitExponent: 2 },
  AOA: { code: "AOA" as CurrencyCode, name: "Angolan Kwanza", minorUnitExponent: 2 },
  CDF: { code: "CDF" as CurrencyCode, name: "Congolese Franc", minorUnitExponent: 2 },
  GNF: { code: "GNF" as CurrencyCode, name: "Guinean Franc", minorUnitExponent: 0 },
  GMD: { code: "GMD" as CurrencyCode, name: "Gambian Dalasi", minorUnitExponent: 2 },
  LRD: { code: "LRD" as CurrencyCode, name: "Liberian Dollar", minorUnitExponent: 2 },
  SLE: { code: "SLE" as CurrencyCode, name: "Sierra Leonean Leone", minorUnitExponent: 2 },
  CVE: { code: "CVE" as CurrencyCode, name: "Cape Verdean Escudo", minorUnitExponent: 2 },
  MAD: { code: "MAD" as CurrencyCode, name: "Moroccan Dirham", minorUnitExponent: 2 },
  DZD: { code: "DZD" as CurrencyCode, name: "Algerian Dinar", minorUnitExponent: 2 },
  TND: { code: "TND" as CurrencyCode, name: "Tunisian Dinar", minorUnitExponent: 3 },
  LYD: { code: "LYD" as CurrencyCode, name: "Libyan Dinar", minorUnitExponent: 3 },
  EGP: { code: "EGP" as CurrencyCode, name: "Egyptian Pound", minorUnitExponent: 2 },
  SDG: { code: "SDG" as CurrencyCode, name: "Sudanese Pound", minorUnitExponent: 2 },
  SSP: { code: "SSP" as CurrencyCode, name: "South Sudanese Pound", minorUnitExponent: 2 },
  ERN: { code: "ERN" as CurrencyCode, name: "Eritrean Nakfa", minorUnitExponent: 2 },
  SOS: { code: "SOS" as CurrencyCode, name: "Somali Shilling", minorUnitExponent: 2 },
  DJF: { code: "DJF" as CurrencyCode, name: "Djiboutian Franc", minorUnitExponent: 0 },
  KMF: { code: "KMF" as CurrencyCode, name: "Comorian Franc", minorUnitExponent: 0 },
  MGA: { code: "MGA" as CurrencyCode, name: "Malagasy Ariary", minorUnitExponent: 2 },
  MRU: { code: "MRU" as CurrencyCode, name: "Mauritanian Ouguiya", minorUnitExponent: 2 },
  MUR: { code: "MUR" as CurrencyCode, name: "Mauritian Rupee", minorUnitExponent: 2 },
  SCR: { code: "SCR" as CurrencyCode, name: "Seychellois Rupee", minorUnitExponent: 2 },
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
