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

export function formatMinor(amountMinor: string | number | bigint, currency = "KES"): string {
  const zeroDecimal = new Set(["UGX", "RWF", "JPY", "XOF", "XAF", "BIF", "GNF", "KMF"]).has(currency);
  const fractionDigits = zeroDecimal ? 0 : 2;
  const divisor = 10n ** BigInt(fractionDigits);
  const minor = BigInt(amountMinor);
  const negative = minor < 0n;
  const absolute = negative ? -minor : minor;
  const whole = absolute / divisor;
  const fraction = fractionDigits ? (absolute % divisor).toString().padStart(fractionDigits, "0") : "";
  const formattedWhole = new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(negative ? -whole : whole);
  return fraction ? `${formattedWhole}.${fraction}` : (negative && whole === 0n ? formattedWhole.replace(/^/, "-") : formattedWhole);
}

export function shortDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(date);
}
