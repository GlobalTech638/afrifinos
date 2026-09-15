import type {
  FinancialAdvice,
  FinancialAdviceResponse,
  FinancialIntelligenceSnapshot,
} from "./intelligence-contracts.js";
import { INTELLIGENCE_SCHEMA_VERSION } from "./intelligence-contracts.js";

export class FinancialAdviceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FinancialAdviceValidationError";
  }
}

const priorities = new Set(["low", "medium", "high"]);
const risks = new Set(["low", "medium", "high"]);

function nonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new FinancialAdviceValidationError(`${field} must be a non-empty string`);
  }
  return value;
}

function stringArray(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length === 0)) {
    throw new FinancialAdviceValidationError(`${field} must be an array of non-empty strings`);
  }
  return value;
}

function validateAdvice(value: unknown, validEvidenceIds: ReadonlySet<string>, index: number): FinancialAdvice {
  if (typeof value !== "object" || value === null) {
    throw new FinancialAdviceValidationError(`advice[${index}] must be an object`);
  }

  const item = value as Record<string, unknown>;
  const priority = item.priority;
  const riskLevel = item.riskLevel;
  if (!priorities.has(String(priority))) {
    throw new FinancialAdviceValidationError(`advice[${index}].priority is invalid`);
  }
  if (!risks.has(String(riskLevel))) {
    throw new FinancialAdviceValidationError(`advice[${index}].riskLevel is invalid`);
  }

  const evidenceIds = stringArray(item.evidenceIds, `advice[${index}].evidenceIds`);
  for (const evidenceId of evidenceIds) {
    if (!validEvidenceIds.has(evidenceId)) {
      throw new FinancialAdviceValidationError(
        `advice[${index}] references unknown evidence ID: ${evidenceId}`,
      );
    }
  }
  if (evidenceIds.length === 0) {
    throw new FinancialAdviceValidationError(`advice[${index}] must contain evidenceIds`);
  }

  return {
    id: nonEmptyString(item.id, `advice[${index}].id`),
    priority: priority as FinancialAdvice["priority"],
    riskLevel: riskLevel as FinancialAdvice["riskLevel"],
    title: nonEmptyString(item.title, `advice[${index}].title`),
    explanation: nonEmptyString(item.explanation, `advice[${index}].explanation`),
    evidenceIds,
    action: nonEmptyString(item.action, `advice[${index}].action`),
  };
}

/**
 * Validates untrusted provider output before it reaches the application.
 * Evidence IDs are checked against the deterministic snapshot, preventing
 * the model from fabricating supporting facts.
 */
export function validateFinancialAdvice(
  value: unknown,
  snapshot: FinancialIntelligenceSnapshot,
): FinancialAdviceResponse {
  if (typeof value !== "object" || value === null) {
    throw new FinancialAdviceValidationError("AI response must be an object");
  }

  const response = value as Record<string, unknown>;
  if (response.schemaVersion !== INTELLIGENCE_SCHEMA_VERSION) {
    throw new FinancialAdviceValidationError("AI response schema version is unsupported");
  }

  const evidenceIds = new Set(snapshot.facts.map((item) => item.id));
  const facts = snapshot.facts.length > 0 ? snapshot.facts : [];
  for (const fact of facts) evidenceIds.add(fact.id);

  if (!Array.isArray(response.advice)) {
    throw new FinancialAdviceValidationError("AI response advice must be an array");
  }

  const advice = response.advice.map((item, index) => validateAdvice(item, evidenceIds, index));
  return {
    schemaVersion: INTELLIGENCE_SCHEMA_VERSION,
    generatedAt: nonEmptyString(response.generatedAt, "generatedAt"),
    advice,
  };
}
