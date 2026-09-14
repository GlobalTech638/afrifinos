import { describe, expect, it } from "vitest";
import { deduplicateTransactions } from "../dedupe.js";
import { parseTransactionCsv } from "../csv.js";

describe("transaction CSV ingestion", () => {
  it("parses quoted Kenyan transaction descriptions and preserves exact minor units", () => {
    const result = parseTransactionCsv([
      "external_id,occurred_at,description,amount_minor,currency,type,counterparty",
      'mpesa-1,2026-09-14T10:00:00+03:00,"Paid, KPLC electricity bill",350000,KES,expense,KPLC',
    ].join("\n"));

    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      externalId: "mpesa-1",
      description: "Paid, KPLC electricity bill",
      amountMinor: 350000n,
      currency: "KES",
      type: "expense",
    });
  });

  it("returns row-level validation errors without discarding valid rows", () => {
    const result = parseTransactionCsv([
      "external_id,occurred_at,description,amount_minor,currency",
      "ok-1,2026-09-14T10:00:00Z,Salary,250000,KES",
      "bad-1,not-a-date,Groceries,nope,KES",
    ].join("\n"));

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].externalId).toBe("ok-1");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].row).toBe(3);
  });

  it("deduplicates repeated provider events by external ID", () => {
    const parsed = parseTransactionCsv([
      "external_id,occurred_at,description,amount_minor,currency",
      "same-1,2026-09-14T10:00:00Z,Salary,250000,KES",
      "same-1,2026-09-14T10:00:00Z,Salary,250000,KES",
    ].join("\n"));

    const result = deduplicateTransactions(parsed.rows, "mpesa");
    expect(result.unique).toHaveLength(1);
    expect(result.duplicates).toHaveLength(1);
  });
});
