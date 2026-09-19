import { describe, expect, it } from "vitest";
import type { Transaction } from "@afrifinos/financial-domain";
import { calculateFinancialTrends } from "../trend-intelligence.js";

function tx(id: string, date: string, type: "income" | "expense", amountMinor: bigint): Transaction {
  return {
    transactionId: id, ownerId: "u", type, status: "posted", occurredAt: date,
    total: { amountMinor, currency: "KES" },
    provenance: { sourceKind: "manual", importedAt: date },
  };
}

describe("financial trends", () => {
  it("compares the latest month with prior history", () => {
    const result = calculateFinancialTrends([
      tx("1", "2026-01-10", "income", 100000n), tx("2", "2026-01-10", "expense", 50000n),
      tx("3", "2026-02-10", "income", 100000n), tx("4", "2026-02-10", "expense", 50000n),
      tx("5", "2026-03-10", "income", 120000n), tx("6", "2026-03-10", "expense", 70000n),
    ], "KES");
    expect(result[0]?.changeMinor).toBe(20000n);
    expect(result[0]?.direction).toBe("up");
    expect(result[1]?.changeMinor).toBe(20000n);
    expect(result[2]?.currentMinor).toBe(50000n);
  });

  it("requires enough history", () => {
    expect(calculateFinancialTrends([
      tx("1", "2026-01-10", "income", 100000n),
      tx("2", "2026-02-10", "income", 100000n),
    ], "KES")).toEqual([]);
  });
});
