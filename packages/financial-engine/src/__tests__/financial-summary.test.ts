import { describe, expect, it } from "vitest";
import { buildFinancialSummary } from "../financial-summary.js";
import type { Account, LedgerEntry, Transaction } from "@afrifinos/financial-domain";

const accounts: readonly Account[] = [
  { accountId: "mpesa", ownerId: "user-1", name: "M-Pesa", type: "mobile_money", currency: "KES", status: "active" },
  { accountId: "bank", ownerId: "user-1", name: "Bank", type: "bank", currency: "KES", status: "active" },
];

const transactions: readonly Transaction[] = [
  {
    transactionId: "salary",
    ownerId: "user-1",
    type: "income",
    status: "posted",
    occurredAt: "2026-09-01T08:00:00Z",
    description: "Salary",
    total: { amountMinor: 100000n, currency: "KES" },
    provenance: { sourceKind: "manual", importedAt: "2026-09-01T08:00:00Z" },
  },
  {
    transactionId: "food",
    ownerId: "user-1",
    type: "expense",
    status: "posted",
    occurredAt: "2026-09-02T08:00:00Z",
    description: "Groceries",
    total: { amountMinor: 25000n, currency: "KES" },
    provenance: { sourceKind: "manual", importedAt: "2026-09-02T08:00:00Z" },
  },
];

const entries: readonly LedgerEntry[] = [
  { entryId: "salary:primary", transactionId: "salary", accountId: "mpesa", currency: "KES", amountMinor: 100000n, direction: "credit", postedAt: "2026-09-01T08:00:00Z" },
  { entryId: "salary:counter", transactionId: "salary", accountId: "income", currency: "KES", amountMinor: 100000n, direction: "debit", postedAt: "2026-09-01T08:00:00Z" },
  { entryId: "food:primary", transactionId: "food", accountId: "mpesa", currency: "KES", amountMinor: 25000n, direction: "debit", postedAt: "2026-09-02T08:00:00Z" },
  { entryId: "food:counter", transactionId: "food", accountId: "expense", currency: "KES", amountMinor: 25000n, direction: "credit", postedAt: "2026-09-02T08:00:00Z" },
];

describe("buildFinancialSummary", () => {
  it("combines deterministic balances, cash flow, savings and health", () => {
    const summary = buildFinancialSummary({
      accounts,
      entries,
      transactions,
      currency: "KES",
      openingBalances: new Map([["mpesa", 50000n], ["bank", 200000n]]),
      debtServiceMinor: 10000n,
      emergencyRunwayMonths: 4,
      spendingVolatility: 0.2,
      goalProgress: 0.5,
    });

    expect(summary.accountBalances.find((balance) => balance.accountId === "mpesa")?.balanceMinor).toBe(125000n);
    expect(summary.liquidBalanceMinor).toBe(325000n);
    expect(summary.cashFlow.incomeMinor).toBe(100000n);
    expect(summary.cashFlow.expenseMinor).toBe(25000n);
    expect(summary.savings.savingsMinor).toBe(75000n);
    expect(summary.savings.savingsRate).toBe(0.75);
    expect(summary.debt.debtBurdenRatio).toBe(0.1);
    expect(summary.healthScore.methodologyVersion).toBe("2026-09-v1");
  });

  it("rejects mixed currencies in assets", () => {
    expect(() => buildFinancialSummary({
      accounts,
      entries: [],
      transactions: [],
      currency: "KES",
      assets: [{
        assetId: "usd-asset",
        ownerId: "user-1",
        name: "USD asset",
        value: { amountMinor: 100n, currency: "USD" },
        assetType: "investment",
        valuedAt: "2026-09-10T00:00:00Z",
      }],
    })).toThrow(/Currency mismatch/);
  });
});
