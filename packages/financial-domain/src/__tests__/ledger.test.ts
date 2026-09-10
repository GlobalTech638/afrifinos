import { describe, expect, it } from "vitest";
import { currencyCode, validateBalancedEntries, type LedgerEntry } from "../index.js";

const KES = currencyCode("KES");

function entry(
  entryId: string,
  accountId: string,
  amountMinor: bigint,
  direction: LedgerEntry["direction"],
): LedgerEntry {
  return {
    entryId,
    transactionId: "txn-1",
    accountId,
    currency: KES,
    amountMinor,
    direction,
    postedAt: "2026-09-10T00:00:00Z",
  };
}

describe("ledger invariants", () => {
  it("accepts a balanced transfer", () => {
    expect(() =>
      validateBalancedEntries([
        entry("e1", "mpesa", 50000n, "debit"),
        entry("e2", "bank", 50000n, "credit"),
      ]),
    ).not.toThrow();
  });

  it("rejects an unbalanced transaction", () => {
    expect(() =>
      validateBalancedEntries([
        entry("e1", "mpesa", 50000n, "debit"),
        entry("e2", "bank", 49000n, "credit"),
      ]),
    ).toThrow(/Unbalanced ledger entries/);
  });

  it("rejects negative entry amounts", () => {
    expect(() =>
      validateBalancedEntries([
        entry("e1", "mpesa", -1n, "debit"),
        entry("e2", "bank", 1n, "credit"),
      ]),
    ).toThrow(/negative amount/);
  });
});
