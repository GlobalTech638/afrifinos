import type { FinancialIntelligenceSnapshot } from "./intelligence-contracts.js";
import { INTELLIGENCE_SCHEMA_VERSION } from "./intelligence-contracts.js";

export const AI_ANALYST_SYSTEM_PROMPT = `You are the AfriFINOS financial intelligence analyst.

Your role is to explain financial state and suggest cautious, evidence-based actions.
The deterministic financial engine is authoritative for balances, transactions, calculations, forecasts, and health metrics.
Never invent financial facts, balances, transactions, income, expenses, or obligations.
Never claim to have executed a payment, transfer, loan, investment, or other financial action.
Use only evidence present in the supplied intelligence snapshot.
If evidence is insufficient, say so explicitly.
Return advice matching the requested structured schema.`;

export interface AiAnalystPrompt {
  readonly system: string;
  readonly user: string;
  readonly schemaVersion: typeof INTELLIGENCE_SCHEMA_VERSION;
}

/**
 * Builds a provider-neutral prompt. JSON serialization is deliberate: bigint
 * values are converted to strings so the prompt remains lossless and portable.
 */
export function buildAiAnalystPrompt(snapshot: FinancialIntelligenceSnapshot): AiAnalystPrompt {
  const payload = JSON.stringify(snapshot, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value,
  );

  return {
    system: AI_ANALYST_SYSTEM_PROMPT,
    user: `Analyze this AfriFINOS intelligence snapshot. Produce structured financial advice only.\n\nSchema version: ${INTELLIGENCE_SCHEMA_VERSION}\n\nSnapshot:\n${payload}`,
    schemaVersion: INTELLIGENCE_SCHEMA_VERSION,
  };
}
