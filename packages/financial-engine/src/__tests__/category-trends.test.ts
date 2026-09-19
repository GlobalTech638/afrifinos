import { describe, expect, it } from "vitest";
import type { Transaction } from "@afrifinos/financial-domain";
import { calculateCategoryTrends } from "../trend-intelligence.js";

function tx(id: string, date: string, amountMinor: bigint, categoryId: string): Transaction {
  return { transactionId: id, ownerId: "u", type: "expense", status: "posted", occurredAt: date, categoryId, total: { amountMinor, currency: "KES" }, provenance: { sourceKind: "manual", importedAt: date } };
}

describe("category trends", () => {
  it("identifies category changes against history", () => {
    const result = calculateCategoryTrends([
      tx("1","2026-01-10",10000n,"transport"), tx("2","2026-02-10",10000n,"transport"), tx("3","2026-03-10",20000n,"transport"),
      tx("4","2026-01-10",5000n,"food"), tx("5","2026-02-10",5000n,"food"), tx("6","2026-03-10",5000n,"food"),
    ], "KES");
    const transport=result.find((item)=>item.categoryId==="transport");
    expect(transport?.changeMinor).toBe(10000n);
    expect(transport?.direction).toBe("up");
  });
});
