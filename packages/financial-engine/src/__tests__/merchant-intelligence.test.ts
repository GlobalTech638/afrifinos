import { describe, expect, it } from "vitest";
import type { Transaction } from "@afrifinos/financial-domain";
import { buildMerchantProfiles } from "../merchant-intelligence.js";

function tx(id: string, date: string, amountMinor: bigint, counterparty: string, categoryId = "utilities"): Transaction {
  return {
    transactionId: id,
    ownerId: "user-1",
    type: "expense",
    status: "posted",
    occurredAt: date,
    counterparty,
    categoryId,
    total: { amountMinor, currency: "KES" },
    provenance: { sourceKind: "manual", importedAt: date },
  };
}

describe("merchant intelligence", () => {
  it("normalizes merchant names and aggregates spend", () => {
    const result = buildMerchantProfiles([
      tx("1", "2026-01-01T08:00:00Z", 1000n, " KPLC  "),
      tx("2", "2026-01-10T08:00:00Z", 3000n, "kplc"),
      tx("3", "2026-01-12T08:00:00Z", 500n, "Safaricom"),
    ], "KES");

    expect(result[0]).toMatchObject({
      merchantKey: "kplc",
      transactionCount: 2,
      totalSpendMinor: 4000n,
      averageSpendMinor: 2000n,
    });
    expect(result[1]?.merchantKey).toBe("safaricom");
  });
});
