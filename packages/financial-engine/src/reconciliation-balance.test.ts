import { describe, expect, it } from "vitest";
import { currencyCode, type LedgerEntry } from "@afrifinos/financial-domain";
import { reconcileAccountBalance } from "./reconciliation.js";

const kes = currencyCode("KES");
const usd = currencyCode("USD");

function entry(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    entryId: "entry-1",
    transactionId: "txn-1",
    accountId: "account-1",
    currency: kes,
    amountMinor: 5000n,
    direction: "credit",
    postedAt: "2026-10-01T10:00:00.000Z",
    ...overrides,
  };
}

function observation(overrides: Partial<Parameters<typeof reconcileAccountBalance>[2]> = {}) {
  return {
    accountId: "account-1",
    currency: kes,
    observedBalanceMinor: 5000n,
    observedAt: "2026-10-01T10:01:00.000Z",
    providerId: "mpesa",
    ...overrides,
  };
}

describe("reconcileAccountBalance", () => {
  it("reports a matched balance when the ledger and provider observation agree", () => {
    const result = reconcileAccountBalance("account-1", [entry()], observation());
    expect(result.ledgerBalanceMinor).toBe(5000n);
    expect(result.observedBalanceMinor).toBe(5000n);
    expect(result.differenceMinor).toBe(0n);
    expect(result.status).toBe("matched");
  });

  it("reports the signed difference when balances disagree", () => {
    const result = reconcileAccountBalance("account-1", [entry()], observation({ observedBalanceMinor: 4700n }));
    expect(result.differenceMinor).toBe(-300n);
    expect(result.status).toBe("difference");
  });

  it("only sums entries for the account being reconciled", () => {
    const result = reconcileAccountBalance("account-1", [
      entry(),
      entry({ entryId: "entry-2", accountId: "account-2", amountMinor: 9000n }),
    ], observation());
    expect(result.ledgerBalanceMinor).toBe(5000n);
    expect(result.status).toBe("matched");
  });

  it("rejects an observation for a different account", () => {
    expect(() => reconcileAccountBalance("account-1", [entry()], observation({ accountId: "account-2" })))
      .toThrow("does not match");
  });

  it("rejects a currency mismatch on the reconciled account", () => {
    expect(() => reconcileAccountBalance("account-1", [entry({ currency: usd })], observation()))
      .toThrow("Currency mismatch");
  });

  it("does not let another account's currency affect this account's reconciliation", () => {
    const result = reconcileAccountBalance("account-1", [
      entry(),
      entry({ entryId: "entry-2", accountId: "account-2", currency: usd }),
    ], observation());
    expect(result.status).toBe("matched");
  });
});
