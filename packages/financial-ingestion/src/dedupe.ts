import type { RawTransaction } from "@afrifinos/financial-engine";

export interface DedupeResult<T extends RawTransaction> {
  readonly unique: readonly T[];
  readonly duplicates: readonly T[];
}

function fingerprint(transaction: RawTransaction): string {
  return [
    transaction.occurredAt,
    transaction.description.trim().toLowerCase().replace(/\s+/g, " "),
    String(transaction.amountMinor),
    transaction.currency,
    transaction.type ?? "",
    transaction.counterparty?.trim().toLowerCase() ?? "",
  ].join("|");
}

/**
 * Deduplicates exact provider events by externalId when available.
 * Rows without an externalId use a deterministic fingerprint. This is
 * intentionally conservative and should be followed by reconciliation before
 * an import is treated as authoritative financial history.
 */
export function deduplicateTransactions<T extends RawTransaction>(
  transactions: readonly T[],
  providerId?: string,
): DedupeResult<T> {
  const seen = new Set<string>();
  const unique: T[] = [];
  const duplicates: T[] = [];

  for (const transaction of transactions) {
    const key = transaction.externalId
      ? `external:${providerId ?? "unknown"}:${transaction.externalId}`
      : `fingerprint:${fingerprint(transaction)}`;

    if (seen.has(key)) {
      duplicates.push(transaction);
      continue;
    }

    seen.add(key);
    unique.push(transaction);
  }

  return { unique, duplicates };
}
