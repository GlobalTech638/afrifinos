import { describe, expect, it } from "vitest";
import { buildLedgerEntries } from "../ledger-posting.js";

describe("ledger posting", () => {
  it("posts an expense as debit from the primary account", () => {
    const entries = buildLedgerEntries({
      transactionId: "tx-expense",
      postedAt: "2026-09-14T10:00:00Z",
      currency: "KES",
      amountMinor: 350000n,
      type: "expense",
      primaryAccountId: "mpesa",
      counterAccountId: "utilities",
    });

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ accountId: "mpesa", amountMinor: 350000n, direction: "debit" });
    expect(entries[1]).toMatchObject({ accountId: "utilities", amountMinor: 350000n, direction: "credit" });
  });

  it("posts income as credit to the primary account", () => {
    const entries = buildLedgerEntries({
      transactionId: "tx-income",
      postedAt: "2026-09-14T10:00:00Z",
      currency: "KES",
      amountMinor: "2500000",
      type: "income",
      primaryAccountId: "bank",
      counterAccountId: "salary",
    });

    expect(entries[0]).toMatchObject({ accountId: "bank", amountMinor: 2500000n, direction: "credit" });
    expect(entries[1]).toMatchObject({ accountId: "salary", amountMinor: 2500000n, direction: "debit" });
  });

  it("posts a transfer between accounts", () => {
    const entries = buildLedgerEntries({
      transactionId: "tx-transfer",
      postedAt: "2026-09-14T10:00:00Z",
      currency: "KES",
      amountMinor: 100000n,
      type: "transfer",
      primaryAccountId: "bank",
      counterAccountId: "mpesa",
    });

    expect(entries.map((entry) => [entry.accountId, entry.direction])).toEqual([
      ["bank", "debit"],
      ["mpesa", "credit"],
    ]);
  });

  it("posts a refund in the opposite direction of an expense", () => {
    const entries = buildLedgerEntries({
      transactionId: "tx-refund",
      postedAt: "2026-09-14T10:00:00Z",
      currency: "KES",
      amountMinor: 50000n,
      type: "refund",
      primaryAccountId: "mpesa",
      counterAccountId: "food",
    });

    expect(entries[0].direction).toBe("credit");
    expect(entries[1].direction).toBe("debit");
  });

  it("rejects zero or negative posting amounts", () => {
    expect(() => buildLedgerEntries({
      transactionId: "tx-zero",
      postedAt: "2026-09-14T10:00:00Z",
      currency: "KES",
      amountMinor: 0,
      type: "expense",
      primaryAccountId: "mpesa",
      counterAccountId: "food",
    })).toThrow("greater than zero");

    expect(() => buildLedgerEntries({
      transactionId: "tx-negative",
      postedAt: "2026-09-14T10:00:00Z",
      currency: "KES",
      amountMinor: -1,
      type: "expense",
      primaryAccountId: "mpesa",
      counterAccountId: "food",
    })).toThrow("greater than zero");
  });

  it("does not silently post reversals or adjustments", () => {
    expect(() => buildLedgerEntries({
      transactionId: "tx-reversal",
      postedAt: "2026-09-14T10:00:00Z",
      currency: "KES",
      amountMinor: 1000,
      type: "reversal",
      primaryAccountId: "mpesa",
      counterAccountId: "food",
    })).toThrow("explicit reversal/adjustment workflow");
  });
});
