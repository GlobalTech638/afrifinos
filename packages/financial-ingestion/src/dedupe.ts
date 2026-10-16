import type { RawTransaction } from "@afrifinos/financial-engine";

export interface DedupeResult<T extends RawTransaction> {
  readonly unique: readonly T[];
  readonly duplicates: readonly T[];
  readonly ambiguous: readonly T[];
}

function fingerprint(transaction: RawTransaction): string {
  // JSON encoding avoids collisions when descriptions/counterparties contain delimiters.
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
 * Deduplicates exact provider events by externalId when a provider namespace
 * is known. Without that namespace, an external ID is not globally unique and
 * is therefore not enough evidence to discard a row.
 *
 * Rows without an externalId use a deterministic fingerprint. Identical
 * fingerprinted rows remain ambiguous because legitimate repeated events can
 * share all visible fields. Reconciliation should resolve those separately.
 */
export function deduplicateTransactions<T extends RawTransaction>(
  transactions: readonly T[],
  providerId?: string,
): DedupeResult<T> {
  const seen = new Set<string>();
  const unique: T[] = [];
  const duplicates: T[] = [];
  const ambiguous: T[] = [];

  for (const transaction of transactions) {
    if (transaction.externalId && providerId?.trim()) {
      const key = JSON.stringify(["external", providerId.trim(), transaction.externalId]);
      if (seen.has(key)) duplicates.push(transaction);
      else {
        seen.add(key);
        unique.push(transaction);
      }
      continue;
    }

    if (transaction.externalId && !providerId?.trim()) {
      // Keep the row; identical IDs from different providers may refer to
      // unrelated transactions, so the missing namespace makes dedupe unsafe.
      ambiguous.push(transaction);
      unique.push(transaction);
      continue;
    }

    const key = JSON.stringify(["fingerprint", fingerprint(transaction)]);
    if (seen.has(key)) {
      ambiguous.push(transaction);
      unique.push(transaction);
      continue;
    }
    seen.add(key);
    unique.push(transaction);
  }

  return { unique, duplicates, ambiguous };
}
