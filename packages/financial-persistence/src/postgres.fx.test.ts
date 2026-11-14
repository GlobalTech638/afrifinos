import { describe, expect, it, vi } from "vitest";
import { PostgresFinancialRepository, type SqlClient } from "./postgres.js";

function repositoryWithRows(rows: readonly Record<string, unknown>[]) {
  const query = vi.fn().mockResolvedValue({ rows });
  const client = { query } as unknown as SqlClient;
  return { repository: new PostgresFinancialRepository(client), query };
}

const conversionRow = {
  conversion_id: "conversion-1",
  quote_id: "quote-1",
  source_transaction_id: "txn-kes",
  destination_transaction_id: "txn-usd",
  base_currency: "KES",
  quote_currency: "USD",
  base_amount_minor: "10000",
  quote_amount_minor: "7200",
  base_minor_unit_exponent: 2,
  quote_minor_unit_exponent: 2,
  rate: "0.720000000000000000",
  rate_source: "test-provider",
  quoted_at: "2026-11-14T10:00:00.000Z",
  expires_at: "2026-11-14T10:05:00.000Z",
  executed_at: "2026-11-14T10:01:00.000Z",
};

describe("PostgresFinancialRepository FX history", () => {
  it("scopes history to the requested owner and orders newest conversions first", async () => {
    const { repository, query } = repositoryWithRows([conversionRow]);

    const records = await repository.getFxConversions("owner-a", 25);

    expect(query).toHaveBeenCalledOnce();
    const [sql, values] = query.mock.calls[0] as [string, readonly unknown[]];
    expect(sql).toContain("WHERE c.owner_id = $1");
    expect(sql).toContain("ORDER BY c.executed_at DESC, c.id DESC");
    expect(values).toEqual(["owner-a", 25]);
    expect(records[0]).toEqual({
      conversionId: "conversion-1",
      quoteId: "quote-1",
      sourceTransactionId: "txn-kes",
      destinationTransactionId: "txn-usd",
      baseCurrency: "KES",
      quoteCurrency: "USD",
      baseAmountMinor: "10000",
      quoteAmountMinor: "7200",
      baseMinorUnitExponent: 2,
      quoteMinorUnitExponent: 2,
      rate: "0.720000000000000000",
      rateSource: "test-provider",
      quotedAt: "2026-11-14T10:00:00.000Z",
      expiresAt: "2026-11-14T10:05:00.000Z",
      executedAt: "2026-11-14T10:01:00.000Z",
    });
  });

  it("clamps repository limits to the supported 1–100 range", async () => {
    const { repository, query } = repositoryWithRows([]);

    await repository.getFxConversions("owner-a", 500);
    expect((query.mock.calls[0] as [string, readonly unknown[]])[1]).toEqual(["owner-a", 100]);

    await repository.getFxConversions("owner-a", 0);
    expect((query.mock.calls[1] as [string, readonly unknown[]])[1]).toEqual(["owner-a", 1]);
  });

  it("rejects an empty owner identifier before querying", async () => {
    const { repository, query } = repositoryWithRows([]);

    await expect(repository.getFxConversions("  ")).rejects.toThrow("FX conversion ownerId cannot be empty");
    expect(query).not.toHaveBeenCalled();
  });
});
