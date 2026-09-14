import { describe, expect, it } from "vitest";
import type { Account, LedgerEntry } from "@afrifinos/financial-domain";
import { buildFinancialSummary } from "../summary.js";
import type { NormalizedTransaction } from "@afrifinos/financial-engine";

const accounts: readonly Account[] = [
  {
    accountId: "mpesa",
    ownerId: "user-1",
    name: "M-Pesa",
    type: "mobile_money",
    currency: "KES",
    status: "active",
  },
];

const entries: readonly LedgerEntry[] = [
  {
    entryId: "income:primary",
    transactionId: "income",
    accountId: "mpesa",
    currency: "KES",
    amountMinor: 100_000n,
    direction: "credit",
    postedAt: "2026-09-01T08:00:00.000Z",
  },
  {
    entryId: "income:counter",
    transactionId: "income",
    accountId: "income-source",
    currency: "KES",
    amountMinor: 100_000n,
    direction: "debit",
    postedAt: "2026-09-01T08:00:00.000Z",
  },
  {
    entryId: "expense:primary",
    transactionId: "expense",
    accountId: "mpesa",
    currency: "KES",
    amountMinor: 30_000n,
    direction: "debit",
    postedAt: "2026-09-02T08:00:00.000Z",
  },
  {
    entryId: "expense:counter",
    transactionId: "expense",
    accountId: "food",
    currency: "KES",
    amountMinor: 30_000n,
    direction: "credit",
    postedAt: "2026-09-02T08:00:00.000Z",
  },
];

const transactions: readonly NormalizedTransaction[] = [
  {
    occurredAt: "2026-09-01T08:00:00.000Z",
    description: "Salary",
    amountMinor: -100_000n,
    currency: "KES",
    type: "income",
  },
  {
    occurredAt: "2026-09-02T08:00:00.000Z",
    description: "Groceries",
    amountMinor: 30_000n,
    currency: "KES",
    type: "expense",
  },
];

describe("buildFinancialSummary", () => {
  it("builds deterministic balances, cash flow, savings and net worth", () => {
    const summary = buildFinancialSummary({
      currency: "KES",
      accounts,
      ledgerEntries: entries,
      transactions,
      openingBalancesMinor: { mpesa: 50_000n },
    });

    expect(summary.version).toBe("2026-09-v1");
    expect(summary.cashBalanceMinor).toBe(120_000n);
    expect(summary.cashFlow.incomeMinor).toBe(100_000n);
    expect(summary.cashFlow.expenseMinor).toBe(30_000n);
    expect(summary.cashFlow.netCashFlowMinor).toBe(70_000n);
    expect(summary.savings.savingsMinor).toBe(70_000n);
    expect(summary.savings.savingsRate).toBe(0.7);
    expect(summary.debt.debtBurdenRatio).toBe(0);
  });

  it("rejects mixed currencies in the summary", () => {
    expect(() => buildFinancialSummary({
      currency: "KES",
      accounts,
      ledgerEntries: entries,
      transactions: [
        ...transactions,
        {
          occurredAt: "2026-09-03T08:00:00.000Z",
          description: "USD income",
          amountMinor: -100n,
          currency: "USD",
          type: "income",
        },
      ],
    })).toThrow(/Currency mismatch/);
  });
});
