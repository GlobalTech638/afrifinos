import type { Provenance } from "@afrifinos/financial-domain";
import { categorize, type CategoryMatch } from "./categorization.js";
import { normalizeTransaction, type NormalizedTransaction, type RawTransaction } from "./normalization.js";

export interface EnrichedTransaction extends NormalizedTransaction {
  readonly categoryId?: string;
  readonly categoryConfidence: number;
  readonly categoryMatchedKeywords: readonly string[];
  readonly categorySource: CategoryMatch["source"];
  readonly provenance: Provenance;
}

export interface TransactionPipelineOptions {
  readonly sourceKind: Provenance["sourceKind"];
  readonly providerId?: string;
  readonly importedAt?: string;
  readonly sourceHash?: string;
}

/**
 * Deterministic ingestion boundary: normalize provider/manual input first,
 * then enrich it with explainable rule-based categorization.
 * No LLM is involved in authoritative financial state creation.
 */
export function processTransaction(
  input: RawTransaction,
  options: TransactionPipelineOptions,
): EnrichedTransaction {
  const normalized = normalizeTransaction(input);
  const match = categorize(normalized.description);

  return {
    ...normalized,
    categoryId: match.categoryId,
    categoryConfidence: match.confidence,
    categoryMatchedKeywords: match.matchedKeywords,
    categorySource: match.source,
    provenance: {
      sourceKind: options.sourceKind,
      providerId: options.providerId,
      externalId: normalized.externalId,
      importedAt: options.importedAt ?? new Date().toISOString(),
      sourceHash: options.sourceHash,
    },
  };
}

export function processTransactions(
  inputs: readonly RawTransaction[],
  options: TransactionPipelineOptions,
): EnrichedTransaction[] {
  return inputs.map((input) => processTransaction(input, options));
}
