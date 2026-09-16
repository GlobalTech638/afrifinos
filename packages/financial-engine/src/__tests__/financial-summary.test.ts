import { describe, expect, it } from "vitest";
import { buildFinancialSummary } from "../financial-summary.js";
import type { Account, LedgerEntry, Obligation, Transaction } from "@afrifinos/financial-domain";

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

  it("counts only explicitly classified debt-service obligations", () => {
    const obligations: readonly Obligation[] = [
      { obligationId: "loan", ownerId: "user-1", name: "Loan repayment", amount: { amountMinor: 10000n, currency: "KES" }, status: "active", recurring: true, recurrence: "monthly", kind: "debt_service" },
      { obligationId: "rent", ownerId: "user-1", name: "Rent", amount: { amountMinor: 30000n, currency: "KES" }, status: "active", recurring: true, recurrence: "monthly", kind: "rent" },
      { obligationId: "subscription", ownerId: "user-1", name: "Subscription", amount: { amountMinor: 5000n, currency: "KES" }, status: "active", recurring: true, recurrence: "monthly", kind: "subscription" },
      { obligationId: "settled-loan", ownerId: "user-1", name: "Settled loan", amount: { amountMinor: 90000n, currency: "KES" }, status: "settled", recurring: true, recurrence: "monthly", kind: "debt_service" },
    ];

    const summary = buildFinancialSummary({ accounts, entries, transactions, obligations, currency: "KES" });

    expect(summary.debt.debtServiceMinor).toBe(10000n);
    expect(summary.debt.debtBurdenRatio).toBe(0.1);
  });

  it("keeps legacy recurring obligations as debt service until reclassified", () => {
    const obligations: readonly Obligation[] = [
      { obligationId: "legacy", ownerId: "user-1", name: "Legacy repayment", amount: { amountMinor: 12000n, currency: "KES" }, status: "active", recurring: true, recurrence: "monthly" },
      { obligationId: "other", ownerId: "user-1", name: "Other", amount: { amountMinor: 3000n, currency: "KES" }, status: "active", recurring: true, recurrence: "monthly", kind: "other" },
    ];

    const summary = buildFinancialSummary({ accounts, entries, transactions, obligations, currency: "KES" });

    expect(summary.debt.debtServiceMinor).toBe(12000n);
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
