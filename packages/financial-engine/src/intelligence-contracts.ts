import type { CurrencyCode } from "@afrifinos/financial-domain";
import type { CashForecast } from "./forecasting.js";
import type { FinancialSummary } from "./financial-summary.js";
import type { TemporalIntelligence } from "./temporal-intelligence.js";
import type { MerchantProfile } from "./merchant-intelligence.js";
import type { CategoryTrend, FinancialTrend, SpendingDriver } from "./trend-intelligence.js";

export const INTELLIGENCE_SCHEMA_VERSION = "2026-09-v1";

export type FinancialFactCategory =
  | "cash_flow"
  | "savings"
  | "debt"
  | "net_worth"
  | "forecast"
  | "liquidity"
  | "recurring"
  | "anomaly"
  | "health";

export type FinancialFactSeverity = "info" | "warning" | "critical";

export interface FinancialFact {
  readonly id: string;
  readonly category: FinancialFactCategory;
  readonly statement: string;
  readonly severity?: FinancialFactSeverity;
  readonly evidence?: readonly string[];
}

export interface FinancialIntelligenceSnapshot {
  readonly schemaVersion: typeof INTELLIGENCE_SCHEMA_VERSION;
  readonly currency: CurrencyCode;
  readonly generatedAt: string;
  readonly summary: FinancialSummary;
  readonly temporal: TemporalIntelligence;
  readonly merchants: readonly MerchantProfile[];
  readonly trends: readonly FinancialTrend[];
  readonly categoryTrends: readonly CategoryTrend[];
  readonly spendingDrivers: readonly SpendingDriver[];
  readonly forecast: CashForecast;
  readonly facts: readonly FinancialFact[];
}

export interface FinancialAdvice {
  readonly id: string;
  readonly priority: "low" | "medium" | "high";
  readonly riskLevel: "low" | "medium" | "high";
  readonly title: string;
  readonly explanation: string;
  readonly evidenceIds: readonly string[];
  readonly action: string;
}

export interface FinancialAdviceResponse {
  readonly schemaVersion: typeof INTELLIGENCE_SCHEMA_VERSION;
  readonly generatedAt: string;
  readonly advice: readonly FinancialAdvice[];
}

export function createFinancialIntelligenceSnapshot(input: {
  readonly summary: FinancialSummary;
  readonly temporal: TemporalIntelligence;
  readonly merchants?: readonly MerchantProfile[];
  readonly trends?: readonly FinancialTrend[];
  readonly categoryTrends?: readonly CategoryTrend[];
  readonly spendingDrivers?: readonly SpendingDriver[];
  readonly forecast: CashForecast;
  readonly facts?: readonly FinancialFact[];
  readonly generatedAt?: string;
}): FinancialIntelligenceSnapshot {
  if (input.summary.currency !== input.temporal.currency) {
    throw new Error("Financial intelligence currency mismatch between summary and temporal analysis");
  }
  if (input.summary.currency !== input.forecast.currency) {
    throw new Error("Financial intelligence currency mismatch between summary and forecast");
  }

  return {
    schemaVersion: INTELLIGENCE_SCHEMA_VERSION,
    currency: input.summary.currency,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    summary: input.summary,
    temporal: input.temporal,
    merchants: input.merchants ?? [],
    trends: input.trends ?? [],
    categoryTrends: input.categoryTrends ?? [],
    spendingDrivers: input.spendingDrivers ?? [],
    forecast: input.forecast,
    facts: input.facts ?? [],
  };
}

export type FinancialSignalSeverity = "info" | "warning" | "critical";
export type FinancialSignalStatus = "active" | "resolved";

export interface FinancialSignal {
  readonly id: string;
  readonly category: FinancialFactCategory;
  readonly severity: FinancialSignalSeverity;
  readonly status: FinancialSignalStatus;
  readonly title: string;
  readonly statement: string;
  readonly evidenceIds: readonly string[];
  readonly detectedAt: string;
}

export function deriveFinancialSignals(
  facts: readonly FinancialFact[],
  detectedAt: string,
): readonly FinancialSignal[] {
  return facts
    .filter((fact) => fact.severity)
    .map((fact) => ({
      id: `signal-${fact.id}`,
      category: fact.category,
      severity: fact.severity ?? "info",
      status: "active",
      title: fact.statement,
      statement: fact.statement,
      evidenceIds: fact.evidence ?? [],
      detectedAt,
    }));
}

export type FinancialSignalSeverity = "info" | "warning" | "critical";
export type FinancialSignalStatus = "active" | "resolved";

export interface FinancialSignal {
  readonly id: string;
  readonly category: FinancialFactCategory;
  readonly severity: FinancialSignalSeverity;
  readonly status: FinancialSignalStatus;
  readonly title: string;
  readonly statement: string;
  readonly evidenceIds: readonly string[];
  readonly generatedAt: string;
}
