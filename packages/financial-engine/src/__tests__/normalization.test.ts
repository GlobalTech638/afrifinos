import { describe, expect, it } from "vitest";
import { categorize } from "../categorization.js";
import { inferTransactionType, normalizeTransaction } from "../normalization.js";

describe("transaction normalization", () => {
  it("normalizes whitespace and exact amounts", () => {
    const result = normalizeTransaction({
      occurredAt: "2026-09-10T08:30:00Z",
      description: "  M-Pesa   Payment to Naivas  ",
      amountMinor: "125050",
      currency: "KES",
    });
    expect(result.description).toBe("M-Pesa Payment to Naivas");
    expect(result.amountMinor).toBe(125050n);
  });

  it("rejects unsafe numeric amounts instead of silently losing minor units", () => {
    expect(() => normalizeTransaction({
      occurredAt: "2026-09-10T08:30:00Z",
      description: "Payment",
      amountMinor: Number.MAX_SAFE_INTEGER + 1,
      currency: "KES",
    })).toThrow("Transaction amount must be a safe integer when provided as a number");
  });

  it("rejects invalid dates, zero amounts, and unsupported currencies", () => {
    const base = { occurredAt: "2026-09-10T08:30:00Z", description: "Payment", amountMinor: 100n, currency: "KES" as const };
    expect(() => normalizeTransaction({ ...base, occurredAt: "not-a-date" })).toThrow("Transaction date must be valid");
    expect(() => normalizeTransaction({ ...base, amountMinor: 0n })).toThrow("Transaction amount cannot be zero");
    expect(() => normalizeTransaction({ ...base, currency: "ZZZ" as "KES" })).toThrow("Transaction currency is not supported");
  });

  it("detects common transaction types", () => {
    expect(inferTransactionType("Monthly salary", 100000)).toBe("income");
    expect(inferTransactionType("Safaricom transfer", 5000)).toBe("transfer");
    expect(inferTransactionType("Transaction fee", 150)).toBe("fee");
    expect(inferTransactionType("Refund from merchant", 1000)).toBe("refund");
  });

  it("uses the sign only as the final fallback", () => {
    expect(inferTransactionType("Unknown merchant", -5000)).toBe("income");
    expect(inferTransactionType("Unknown merchant", 5000)).toBe("expense");
  });
});

describe("categorization", () => {
  it("categorizes Kenyan spending using deterministic rules", () => {
    const result = categorize("M-Pesa payment to Naivas supermarket");
    expect(result.categoryId).toBe("food");
    expect(result.source).toBe("rule");
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it("does not invent a category", () => {
    const result = categorize("Payment to unknown merchant XYZ");
    expect(result.categoryId).toBeUndefined();
    expect(result.source).toBe("none");
  });
});
