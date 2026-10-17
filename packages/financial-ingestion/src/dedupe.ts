import type { RawTransaction } from "@afrifinos/financial-engine";

export interface DedupeResult<T extends RawTransaction> {
  readonly unique: readonly T[];
  readonly duplicates: readonly T[];
  readonly ambiguous: readonly T[];
}

function fingerprint(transaction: RawTransaction): string {
  return JSON.stringify([
    transaction.occurredAt,
    transaction.description.trim().toLowerCase().replace(/\s+/g, " "),
    String(transaction.amountMinor),
    transaction.currency,
    transaction.type ?? "",
    transaction.counterparty?.trim().toLowerCase() ?? "",
  ]);
}

/**
 * Conservative duplicate handling:
 * - Exact repeated events with the same provider-scoped external ID and payload
 *   are duplicates.
 * - Reused external IDs with conflicting payloads are retained and flagged.
 * - Fingerprint-only matches are retained and flagged because legitimate
 *   repeated payments can share all visible fields.
 */
export function deduplicateTransactions<T extends RawTransaction>(
  transactions: readonly T[],
  providerId?: string,
): DedupeResult<T> {
  const seenExternal = new Map<string, string>();
  const seenFingerprints = new Set<string>();
  const unique: T[] = [];
  const duplicates: T[] = [];
  const ambiguous: T[] = [];

  for (const transaction of transactions) {
    const eventFingerprint = fingerprint(transaction);

    if (transaction.externalId && providerId?.trim()) {
      const key = JSON.stringify([providerId.trim(), transaction.externalId]);
      const previousFingerprint = seenExternal.get(key);

      if (previousFingerprint === undefined) {
        seenExternal.set(key, eventFingerprint);
        unique.push(transaction);
      } else if (previousFingerprint === eventFingerprint) {
        duplicates.push(transaction);
      } else {
        // Same provider ID but different data may be an update, reversal,
        // provider defect, or ID collision. Never discard it automatically.
        ambiguous.push(transaction);
        unique.push(transaction);
      }
      continue;
    }

    if (transaction.externalId && !providerId?.trim()) {
      ambiguous.push(transaction);
      unique.push(transaction);
      continue;
    }

    if (seenFingerprints.has(eventFingerprint)) {
      ambiguous.push(transaction);
      unique.push(transaction);
      continue;
    }

    seenFingerprints.add(eventFingerprint);
    unique.push(transaction);
  }

  return { unique, duplicates, ambiguous };
}
