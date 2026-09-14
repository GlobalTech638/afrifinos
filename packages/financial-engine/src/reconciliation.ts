import type { CurrencyCode, LedgerEntry } from "@afrifinos/financial-domain";
import { signedAmount } from "@afrifinos/financial-domain";
import type { RawTransaction } from "./normalization.js";

export interface TransactionIdentity {
  readonly providerId?: string;
  readonly externalId?: string;
  readonly fingerprint: string;
}

function normalizeDescription(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function transactionFingerprint(transaction: RawTransaction): string {
  return [
    transaction.occurredAt,
    normalizeDescription(transaction.description),
    String(transaction.amountMinor),
    transaction.currency,
    transaction.type ?? "",
    normalizeDescription(transaction.counterparty ?? ""),
  ].join("|");
}

export function identifyTransaction(
  transaction: RawTransaction,
  providerId?: string,
): TransactionIdentity {
  return {
    providerId,
    externalId: transaction.externalId,
    fingerprint: transactionFingerprint(transaction),
  };
}

export interface ProviderBalanceObservation {
  readonly accountId: string;
  readonly currency: CurrencyCode;
  readonly observedBalanceMinor: bigint;
  readonly observedAt: string;
  readonly providerId?: string;
}

export interface ReconciliationResult {
  readonly accountId: string;
  readonly currency: CurrencyCode;
  readonly ledgerBalanceMinor: bigint;
  readonly observedBalanceMinor: bigint;
  readonly differenceMinor: bigint;
  readonly status: "matched" | "difference";
}

export function reconcileAccountBalance(
  accountId: string,
  entries: readonly LedgerEntry[],
  observation: ProviderBalanceObservation,
): ReconciliationResult {
  if (observation.accountId !== accountId) {
    throw new Error(`Observation account ${observation.accountId} does not match ${accountId}`);
  }

  let ledgerBalanceMinor = 0n;
  for (const entry of entries) {
    if (entry.accountId !== accountId) continue;
    if (entry.currency !== observation.currency) {
      throw new Error(`Currency mismatch for account ${accountId}`);
    }
    ledgerBalanceMinor += signedAmount(entry);
  }

  const differenceMinor = observation.observedBalanceMinor - ledgerBalanceMinor;
  return {
    accountId,
    currency: observation.currency,
    ledgerBalanceMinor,
    observedBalanceMinor: observation.observedBalanceMinor,
    differenceMinor,
    status: differenceMinor === 0n ? "matched" : "difference",
  };
}
