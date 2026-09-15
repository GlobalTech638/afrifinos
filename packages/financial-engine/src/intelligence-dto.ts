import type { FinancialIntelligenceSnapshot, FinancialAdviceResponse } from "./intelligence-contracts.js";

export interface MoneyDto {
  readonly amountMinor: string;
  readonly currency: string;
}

export interface FinancialIntelligenceDto {
  readonly schemaVersion: string;
  readonly generatedAt: string;
  readonly currency: string;
  readonly summary: unknown;
  readonly temporal: unknown;
  readonly forecast: unknown;
  readonly facts: FinancialIntelligenceSnapshot["facts"];
}

export interface FinancialAdviceDto {
  readonly schemaVersion: string;
  readonly generatedAt: string;
  readonly advice: FinancialAdviceResponse["advice"];
}

function serializeBigInts(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(serializeBigInts);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, serializeBigInts(child)]),
    );
  }
  return value;
}

export function toFinancialIntelligenceDto(
  snapshot: FinancialIntelligenceSnapshot,
): FinancialIntelligenceDto {
  return serializeBigInts({
    schemaVersion: snapshot.schemaVersion,
    generatedAt: snapshot.generatedAt,
    currency: snapshot.currency,
    summary: snapshot.summary,
    temporal: snapshot.temporal,
    forecast: snapshot.forecast,
    facts: snapshot.facts,
  }) as FinancialIntelligenceDto;
}

export function toFinancialAdviceDto(
  response: FinancialAdviceResponse,
): FinancialAdviceDto {
  return response as FinancialAdviceDto;
}
