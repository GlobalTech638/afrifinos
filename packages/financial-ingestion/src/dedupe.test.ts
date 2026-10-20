import { describe, expect, it } from "vitest";
import { deduplicateTransactions } from "./dedupe.js";
import type { RawTransaction } from "@afrifinos/financial-engine";
import { currencyCode } from "@afrifinos/financial-domain";

function tx(overrides: Partial<RawTransaction> = {}): RawTransaction {
  return {
    externalId: "txn-1",
    occurredAt: "2026-10-01T10:00:00.000Z",
    description: "Payment to shop",
    amountMinor: 1200n,
    currency: currencyCode("KES"),
    type: "expense",
    counterparty: "Shop",
    ...overrides,
  };
}

describe("deduplicateTransactions", () => {
  it("deduplicates exact repeated provider events", () => {
    const result = deduplicateTransactions([tx(), tx()], "mpesa");
    expect(result.unique).toHaveLength(1);
    expect(result.duplicates).toHaveLength(1);
    expect(result.ambiguous).toHaveLength(0);
  });

  it("retains reused external IDs when payloads conflict", () => {
    const result = deduplicateTransactions([tx(), tx({ amountMinor: 1500n })], "mpesa");
    expect(result.unique).toHaveLength(2);
    expect(result.duplicates).toHaveLength(0);
    expect(result.ambiguous).toHaveLength(1);
  });

  it("does not deduplicate IDs when provider namespace is missing", () => {
    const result = deduplicateTransactions([tx(), tx()]);
    expect(result.unique).toHaveLength(2);
    expect(result.duplicates).toHaveLength(0);
    expect(result.ambiguous).toHaveLength(2);
  });

  it("keeps identical external IDs distinct across provider-scoped batches", () => {
    const bankA = deduplicateTransactions([tx()], "bank-a");
    const bankB = deduplicateTransactions([tx()], "bank-b");
    expect(bankA.unique).toHaveLength(1);
    expect(bankA.duplicates).toHaveLength(0);
    expect(bankB.unique).toHaveLength(1);
    expect(bankB.duplicates).toHaveLength(0);
  });

  it("keeps identical fingerprint rows ambiguous, not silently discarded", () => {
    const result = deduplicateTransactions([
      tx({ externalId: undefined }),
      tx({ externalId: undefined }),
    ], "csv-import");
    expect(result.unique).toHaveLength(2);
    expect(result.duplicates).toHaveLength(0);
    expect(result.ambiguous).toHaveLength(1);
  });

  it("avoids fingerprint collisions from delimiter characters", () => {
    const first = tx({ externalId: undefined, description: "A|B", counterparty: "C" });
    const second = tx({ externalId: undefined, description: "A", counterparty: "B|C" });
    const result = deduplicateTransactions([first, second], "csv-import");
    expect(result.unique).toHaveLength(2);
    expect(result.ambiguous).toHaveLength(0);
  });
});
