import type { CurrencyCode } from "./currency.js";

export type LedgerEntryDirection = "debit" | "credit";

/**
 * A posted ledger entry. Amounts are always positive; direction carries the sign.
 * The financial-domain package validates that a transaction's entries balance
 * independently for every currency.
 */
export interface LedgerEntry {
  readonly entryId: string;
  readonly transactionId: string;
  readonly accountId: string;
  readonly currency: CurrencyCode;
  readonly amountMinor: bigint;
  readonly direction: LedgerEntryDirection;
  readonly postedAt: string;
}

export function signedAmount(entry: LedgerEntry): bigint {
  return entry.direction === "debit" ? -entry.amountMinor : entry.amountMinor;
}

export function validateBalancedEntries(entries: readonly LedgerEntry[]): void {
  if (entries.length < 2) {
    throw new Error("A balanced transaction requires at least two ledger entries");
  }

  const totals = new Map<CurrencyCode, bigint>();
  for (const entry of entries) {
    if (entry.amountMinor < 0n) {
      throw new Error(`Ledger entry ${entry.entryId} has a negative amount`);
    }
    totals.set(entry.currency, (totals.get(entry.currency) ?? 0n) + signedAmount(entry));
  }

  for (const [currency, total] of totals) {
    if (total !== 0n) {
      throw new Error(`Unbalanced ledger entries for ${currency}: ${total}`);
    }
  }
}
