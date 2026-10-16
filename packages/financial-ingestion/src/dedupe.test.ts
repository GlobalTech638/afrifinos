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
  it("deduplicates repeated external IDs within the same provider", () => {
    const result = deduplicateTransactions([tx(), tx()], "mpesa");
    expect(result.unique).toHaveLength(1);
    expect(result.duplicates).toHaveLength(1);
    expect(result.ambiguous).toHaveLength(0);
  });

  it("does not deduplicate equal IDs when provider namespace is missing", () => {
    const result = deduplicateTransactions([tx(), tx()]);
    expect(result.unique).toHaveLength(2);
    expect(result.duplicates).toHaveLength(0);
    expect(result.ambiguous).toHaveLength(2);
  });

  it("does not treat equal IDs from different providers as duplicates", () => {
    const result = deduplicateTransactions([tx(), tx()], "bank-a");
    expect(result.unique).toHaveLength(1);
    expect(result.duplicates).toHaveLength(1);
    // The provider namespace is the caller's batch scope. Cross-provider rows
    // must be processed in separate calls or with an explicit source namespace.
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
