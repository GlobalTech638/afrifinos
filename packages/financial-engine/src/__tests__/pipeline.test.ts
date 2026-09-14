import { describe, expect, it } from "vitest";
import { processTransaction } from "../pipeline.js";

describe("transaction pipeline", () => {
  it("normalizes and categorizes a Kenyan-style transaction deterministically", () => {
    const result = processTransaction(
      {
        externalId: "mpesa-001",
        occurredAt: "2026-09-14T10:00:00+03:00",
        description: "  Paid KPLC electricity bill  ",
        amountMinor: "350000",
        currency: "KES",
      },
      { sourceKind: "provider_file", providerId: "mpesa" },
    );

    expect(result.description).toBe("Paid KPLC electricity bill");
    expect(result.amountMinor).toBe(350000n);
    expect(result.type).toBe("expense");
    expect(result.categoryId).toBe("utilities");
    expect(result.categorySource).toBe("rule");
    expect(result.provenance.externalId).toBe("mpesa-001");
  });

  it("preserves explicit transaction types", () => {
    const result = processTransaction(
      {
        occurredAt: "2026-09-14T10:00:00Z",
        description: "M-Pesa transfer",
        amountMinor: 1000,
        currency: "KES",
        type: "transfer",
      },
      { sourceKind: "manual" },
    );

    expect(result.type).toBe("transfer");
  });
});
