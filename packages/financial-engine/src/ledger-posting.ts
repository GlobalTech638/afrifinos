import type { CurrencyCode } from "@afrifinos/financial-domain";
import { validateBalancedEntries, type LedgerEntry } from "@afrifinos/financial-domain";
import type { NormalizedTransactionType } from "./normalization.js";

export interface LedgerPostingInput {
  readonly transactionId: string;
  readonly postedAt: string;
  readonly currency: CurrencyCode;
  readonly amountMinor: bigint | number | string;
  readonly type: NormalizedTransactionType;
  readonly primaryAccountId: string;
  readonly counterAccountId: string;
}

function positiveAmount(value: bigint | number | string): bigint {
  const amount = BigInt(value);
  if (amount <= 0n) throw new Error("Ledger posting amount must be greater than zero");
  return amount;
}

function entry(
  transactionId: string,
  postedAt: string,
  accountId: string,
  currency: CurrencyCode,
  amountMinor: bigint,
  direction: LedgerEntry["direction"],
  suffix: "primary" | "counter",
): LedgerEntry {
  return {
    entryId: `${transactionId}:${suffix}`,
    transactionId,
    accountId,
    currency,
    amountMinor,
    direction,
    postedAt,
  };
}

/**
 * Converts a normalized transaction into exactly two balanced ledger entries.
 * The primary account is the user's cash/liquid account; the counter account
 * represents the income, expense, fee, transfer destination/source, or refund
 * side of the transaction.
 */
export function buildLedgerEntries(input: LedgerPostingInput): readonly LedgerEntry[] {
  const amount = positiveAmount(input.amountMinor);
  if (!input.transactionId) throw new Error("transactionId cannot be empty");
  if (!input.primaryAccountId || !input.counterAccountId) {
    throw new Error("Both primaryAccountId and counterAccountId are required");
  }
  if (input.primaryAccountId === input.counterAccountId) {
    throw new Error("Primary and counter accounts must be different");
  }

  let entries: readonly LedgerEntry[];

  switch (input.type) {
    case "income":
      entries = [
        entry(input.transactionId, input.postedAt, input.primaryAccountId, input.currency, amount, "credit", "primary"),
        entry(input.transactionId, input.postedAt, input.counterAccountId, input.currency, amount, "debit", "counter"),
      ];
      break;
    case "expense":
    case "fee":
      entries = [
        entry(input.transactionId, input.postedAt, input.primaryAccountId, input.currency, amount, "debit", "primary"),
        entry(input.transactionId, input.postedAt, input.counterAccountId, input.currency, amount, "credit", "counter"),
      ];
      break;
    case "transfer":
      entries = [
        entry(input.transactionId, input.postedAt, input.primaryAccountId, input.currency, amount, "debit", "primary"),
        entry(input.transactionId, input.postedAt, input.counterAccountId, input.currency, amount, "credit", "counter"),
      ];
      break;
    case "refund":
      entries = [
        entry(input.transactionId, input.postedAt, input.primaryAccountId, input.currency, amount, "credit", "primary"),
        entry(input.transactionId, input.postedAt, input.counterAccountId, input.currency, amount, "debit", "counter"),
      ];
      break;
    case "reversal":
    case "adjustment":
      throw new Error(`${input.type} postings require an explicit reversal/adjustment workflow`);
    default:
      throw new Error(`Unsupported transaction type: ${String(input.type)}`);
  }

  validateBalancedEntries(entries);
  return entries;
}
