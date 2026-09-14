import { describe, expect, it } from "vitest";
import { reconcileAccountBalance, transactionFingerprint } from "../reconciliation.js";
import { buildLedgerEntries } from "../ledger-posting.js";

describe("transaction identity", () => {
  it("produces a stable fingerprint for equivalent source data", () => {
    const a = {
      occurredAt: "2026-09-14T10:00:00.000Z",
      description: "  Naivas   supermarket ",
      amountMinor: 125000,
      currency: "KES" as const,
      type: "expense" as const,
      counterparty: " Naivas ",
    };
    const b = { ...a, description: "Naivas supermarket", counterparty: "Naivas" };
    expect(transactionFingerprint(a)).toBe(transactionFingerprint(b));
  });
});

describe("account reconciliation", () => {
  const entries = buildLedgerEntries({
    transactionId: "tx-1",
    postedAt: "2026-09-14T10:00:00.000Z",
    currency: "KES",
    amountMinor: 100000,
    type: "income",
    primaryAccountId: "mpesa",
    counterAccountId: "salary",
  });

  it("matches an observed provider balance", () => {
    const result = reconcileAccountBalance("mpesa", entries, {
      accountId: "mpesa",
      currency: "KES",
      observedBalanceMinor: 100000n,
      observedAt: "2026-09-14T11:00:00.000Z",
      providerId: "mpesa",
    });

    expect(result.ledgerBalanceMinor).toBe(100000n);
    expect(result.differenceMinor).toBe(0n);
    expect(result.status).toBe("matched");
  });

  it("surfaces unexplained differences instead of mutating the ledger", () => {
    const result = reconcileAccountBalance("mpesa", entries, {
      accountId: "mpesa",
      currency: "KES",
      observedBalanceMinor: 125000n,
      observedAt: "2026-09-14T11:00:00.000Z",
    });

    expect(result.differenceMinor).toBe(25000n);
    expect(result.status).toBe("difference");
  });
});
