import type { FinancialAdviceResponse, FinancialIntelligenceSnapshot } from "./intelligence-contracts.js";
import { buildAiAnalystPrompt, type AiAnalystPrompt } from "./ai-prompt.js";
import { validateFinancialAdvice } from "./ai-validation.js";

export interface StructuredAiProvider {
  readonly name: string;
  complete(prompt: AiAnalystPrompt): Promise<unknown>;
}

export interface StructuredAiAnalyst {
  readonly provider: string;
  analyze(snapshot: FinancialIntelligenceSnapshot): Promise<FinancialAdviceResponse>;
}

/**
 * Adapts any LLM client to AfriFINOS without importing a vendor SDK into the
 * financial engine. Provider output is untrusted until validated.
 */
export function createStructuredAiAnalyst(provider: StructuredAiProvider): StructuredAiAnalyst {
  return {
    provider: provider.name,
    async analyze(snapshot) {
      const prompt = buildAiAnalystPrompt(snapshot);
      const output = await provider.complete(prompt);
      return validateFinancialAdvice(output, snapshot);
    },
  };
}
