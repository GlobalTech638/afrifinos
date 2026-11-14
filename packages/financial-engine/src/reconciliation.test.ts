import { describe, expect, it } from "vitest";
import { currencyCode } from "@afrifinos/financial-domain";
import { transactionFingerprint, identifyTransaction } from "./reconciliation.js";
import type { RawTransaction } from "./normalization.js";

function tx(overrides: Partial<RawTransaction> = {}): RawTransaction {
  return {
    occurredAt: "2026-10-01T10:00:00.000Z",
    description: "Payment",
    amountMinor: 1200n,
    currency: currencyCode("KES"),
    type: "expense",
    counterparty: "Shop",
    ...overrides,
  };
}

describe("transaction fingerprints", () => {
  it("does not collide when text fields contain delimiter characters", () => {
    const first = tx({ description: "A|B", counterparty: "C" });
    const second = tx({ description: "A", counterparty: "B|C" });
    expect(transactionFingerprint(first)).not.toBe(transactionFingerprint(second));
  });

  it("normalizes description whitespace and case for equivalent records", () => {
    const first = tx({ description: "  PAYMENT   to Shop " });
    const second = tx({ description: "payment to shop" });
    expect(transactionFingerprint(first)).toBe(transactionFingerprint(second));
  });

  it("retains provider and external ID as explicit identity fields", () => {
    const identity = identifyTransaction(tx({ externalId: "ext-7" }), "mpesa");
    expect(identity.providerId).toBe("mpesa");
    expect(identity.externalId).toBe("ext-7");
    expect(identity.fingerprint).toBe(transactionFingerprint(tx({ externalId: "ext-7" })));
  });
});
