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
  // JSON array encoding preserves field boundaries even when provider text
  // contains delimiter characters.
  return JSON.stringify([
    transaction.occurredAt,
    normalizeDescription(transaction.description),
    String(transaction.amountMinor),
    transaction.currency,
    transaction.type ?? "",
    normalizeDescription(transaction.counterparty ?? ""),
  ]);
}

export function identifyTransaction(
  transaction: RawTransaction,
  providerId?: string,
): TransactionIdentity {
  return {
    ...(providerId ? { providerId } : {}),
    ...(transaction.externalId ? { externalId: transaction.externalId } : {}),
    fingerprint: transactionFingerprint(transaction),
  };
}

export interface ProviderBalanceObservation {
  readonly accountId: string;
  readonly currency: CurrencyCode;
  readonly observedBalanceMinor: bigint;
  readonly observedAt: string;
  readonly providerId?: string;
  /** Provider-supplied stable ID for this balance snapshot, when available. */
  readonly externalObservationId?: string;
}

export interface ReconciliationResult {
  readonly accountId: string;
  readonly currency: CurrencyCode;
  readonly ledgerBalanceMinor: bigint;
  readonly observedBalanceMinor: bigint;
  /** Provider-observed balance minus the ledger-derived balance; positive means the provider reports more funds. */
  readonly differenceMinor: bigint;
  readonly observedAt: string;
  readonly providerId?: string;
  readonly observationKey: string;
  readonly status: "matched" | "difference";
}

function isValidObservationTimestamp(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const calendarDate = new Date(0);
  calendarDate.setUTCHours(0, 0, 0, 0);
  calendarDate.setUTCFullYear(year, month - 1, day);
  return calendarDate.getUTCFullYear() === year
    && calendarDate.getUTCMonth() === month - 1
    && calendarDate.getUTCDate() === day;
}

/**
 * Produces a deterministic idempotency key for a provider balance observation.
 * Provider observation IDs are scoped by account and provider; without one,
 * the full observation payload is used so distinct snapshots remain distinct.
 */
export function reconciliationObservationKey(observation: ProviderBalanceObservation): string {
  if (observation.externalObservationId !== undefined) {
    if (!observation.externalObservationId.trim()) {
      throw new Error("External observation ID cannot be empty");
    }
    if (!observation.providerId?.trim()) {
      throw new Error("External observation ID requires a provider ID");
    }
    return JSON.stringify([
      observation.accountId,
      observation.providerId,
      observation.externalObservationId,
    ]);
  }

  return JSON.stringify([
    observation.accountId,
    observation.providerId ?? "",
    observation.currency,
    observation.observedAt,
    observation.observedBalanceMinor.toString(),
  ]);
}

export function reconcileAccountBalance(
  accountId: string,
  entries: readonly LedgerEntry[],
  observation: ProviderBalanceObservation,
): ReconciliationResult {
  if (!accountId.trim()) {
    throw new Error("Account ID cannot be empty");
  }
  if (observation.accountId !== accountId) {
    throw new Error(`Observation account ${observation.accountId} does not match ${accountId}`);
  }
  if (!isValidObservationTimestamp(observation.observedAt)) {
    throw new Error("Observation timestamp must be an ISO 8601 date-time");
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
    observedAt: observation.observedAt,
    ...(observation.providerId ? { providerId: observation.providerId } : {}),
    observationKey: reconciliationObservationKey(observation),
    status: differenceMinor === 0n ? "matched" : "difference",
  };
}
