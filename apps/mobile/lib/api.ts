import type { Session } from "@supabase/supabase-js";

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000").replace(/\/$/, "");

export type Account = {
  accountId: string;
  name: string;
  type: "mobile_money" | "bank" | "cash" | "sacco" | "investment" | "loan" | "other";
  currency: string;
  status: string;
};

export type Transaction = {
  transactionId: string;
  occurredAt: string;
  description: string;
  type: string;
  status: string;
  total: { amountMinor: string; currency: string };
  counterparty?: string;
};

export type FxConversion = {
  conversionId: string;
  quoteId: string;
  sourceTransactionId: string;
  destinationTransactionId: string;
  baseCurrency: string;
  quoteCurrency: string;
  baseAmountMinor: string;
  quoteAmountMinor: string;
  baseMinorUnitExponent: number;
  quoteMinorUnitExponent: number;
  rate: string;
  rateSource: string;
  quotedAt: string;
  expiresAt: string;
  executedAt: string;
};

export type AffordabilityResult = {
  decision: string;
  projectedMinimumBalanceMinor: string;
  bufferShortfallMinor: string;
  reasons: string[];
};

export type Intelligence = {
  currency: string;
  summary: {
    liquidBalanceMinor: string;
    cashFlow: { incomeMinor: string; expenseMinor: string; netCashFlowMinor: string };
    savings: { savingsRate: number | null };
    debt: { debtBurdenRatio: number | null };
    healthScore: { score: number; band: string };
    netWorth?: { amountMinor: string };
    resilience?: { emergencyRunwayMonths: number | null; spendingVolatility: number | null };
  };
  forecast: {
    endingBalanceMinor: string;
    minimumProjectedBalanceMinor: string;
    runwayDays: number | null;
  };
  facts: { id: string; statement: string; severity?: string }[];
  temporal: { recurring: { key: string; description: string; averageAmountMinor: string; cadence: string }[] };
};

async function request<T>(path: string, session: Session, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      ...init.headers,
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(payload?.message ?? `AfriFinos API returned ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  accounts: (session: Session) => request<Account[]>("/accounts", session),
  transactions: (session: Session) => request<Transaction[]>("/transactions", session),
  fxConversions: (session: Session, limit = 50) => request<FxConversion[]>(`/fx/conversions?limit=${limit}`, session),
  intelligence: (session: Session, currency = "KES") =>
    request<Intelligence>(`/financial/intelligence?currency=${encodeURIComponent(currency)}`, session),
  createAccount: (session: Session, body: { name: string; type: Account["type"]; currency: string }) =>
    request<Account>("/accounts", session, { method: "POST", body: JSON.stringify(body) }),
  affordability: (session: Session, amountMinor: string, currency = "KES", additionalRecurringMonthlyMinor = "0") => {
    const params = new URLSearchParams({ amountMinor, currency, additionalRecurringMonthlyMinor });
    return request<AffordabilityResult>(`/financial/affordability?${params.toString()}`, session);
  },
  createTransaction: (session: Session, body: {
    primaryAccountId: string;
    counterAccountId: string;
    occurredAt: string;
    description: string;
    amountMinor: string;
    currency: string;
    type: string;
    sourceKind: "manual";
  }) => request<unknown>("/transactions", session, { method: "POST", body: JSON.stringify(body) }),
};

const ZERO_DECIMAL_CURRENCIES = new Set(["UGX", "RWF", "BIF", "XOF", "XAF", "GNF", "KMF", "DJF"]);
const THREE_DECIMAL_CURRENCIES = new Set(["TND", "LYD"]);

export function currencyMinorUnitExponent(currency: string): number {
  const code = currency.trim().toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return 0;
  if (THREE_DECIMAL_CURRENCIES.has(code)) return 3;
  return 2;
}

/** Convert a user-entered major-unit amount to an exact integer minor-unit string. */
export function parseMajorToMinor(value: string, currency: string): string | null {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const digits = currencyMinorUnitExponent(currency);
  const [whole = "0", fraction = ""] = normalized.split(".");
  if (fraction.length > digits) return null;
  const minor = BigInt(whole) * (10n ** BigInt(digits)) +
    BigInt(digits ? fraction.padEnd(digits, "0") || "0" : "0");
  return minor > 0n ? minor.toString() : null;
}

export function formatMinor(amountMinor: string | number | bigint, currency = "KES"): string {
  const code = currency.trim().toUpperCase();
  const fractionDigits = currencyMinorUnitExponent(code);
  const divisor = 10n ** BigInt(fractionDigits);
  const minor = BigInt(amountMinor);
  const negative = minor < 0n;
  const absolute = negative ? -minor : minor;
  const whole = absolute / divisor;
  const fraction = fractionDigits ? (absolute % divisor).toString().padStart(fractionDigits, "0") : "";
  const formattedWhole = new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: code,
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(whole);
  const signedWhole = negative ? `-${formattedWhole}` : formattedWhole;
  return fraction ? `${signedWhole}.${fraction}` : signedWhole;
}

export function shortDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(date);
}
