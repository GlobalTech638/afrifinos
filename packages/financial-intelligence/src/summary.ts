import type {
  Account,
  Asset,
  CurrencyCode,
  Liability,
  LedgerEntry,
} from "@afrifinos/financial-domain";
import {
  calculateNetWorth,
  calculateAccountBalances,
  calculateDebtMetrics,
  calculateSavingsMetrics,
  type AccountBalance,
  type CashFlowSummary,
  type DebtMetrics,
  type SavingsMetrics,
} from "@afrifinos/financial-engine";
import type { NormalizedTransaction } from "@afrifinos/financial-engine";

export const FINANCIAL_SUMMARY_VERSION = "2026-09-v1";

export interface FinancialSummaryInput {
  readonly currency: CurrencyCode;
  readonly accounts: readonly Account[];
  readonly ledgerEntries: readonly LedgerEntry[];
  readonly transactions: readonly NormalizedTransaction[];
  readonly assets?: readonly Asset[];
  readonly liabilities?: readonly Liability[];
  readonly openingBalancesMinor?: Readonly<Record<string, bigint>>;
  readonly debtServiceMinor?: bigint;
}

export interface FinancialSummary {
  readonly version: string;
  readonly currency: CurrencyCode;
  readonly accountBalances: readonly AccountBalance[];
  readonly cashBalanceMinor: bigint;
  readonly cashFlow: CashFlowSummary;
  readonly savings: SavingsMetrics;
  readonly debt: DebtMetrics;
  readonly netWorthMinor: bigint;
  readonly assetsMinor: bigint;
  readonly liabilitiesMinor: bigint;
}

function assertCurrency(value: CurrencyCode, expected: CurrencyCode, label: string): void {
  if (value !== expected) {
    throw new Error(`Currency mismatch for ${label}: expected ${expected}, received ${value}`);
  }
}

function calculateCashFlow(transactions: readonly NormalizedTransaction[], currency: CurrencyCode): CashFlowSummary {
  let incomeMinor = 0n;
  let expenseMinor = 0n;

  for (const transaction of transactions) {
    assertCurrency(transaction.currency, currency, "transaction");
    const amount = transaction.amountMinor;

    if (transaction.type === "income" || transaction.type === "refund") {
      incomeMinor += amount < 0n ? -amount : amount;
    } else if (transaction.type === "expense" || transaction.type === "fee") {
      expenseMinor += amount < 0n ? -amount : amount;
    }
  }

  return {
    incomeMinor,
    expenseMinor,
    netCashFlowMinor: incomeMinor - expenseMinor,
  };
}

export function buildFinancialSummary(input: FinancialSummaryInput): FinancialSummary {
  const openingBalances = input.openingBalancesMinor ?? {};
  const accountBalances = calculateAccountBalances(input.accounts, input.ledgerEntries).map((balance) => ({
    ...balance,
    balanceMinor: balance.balanceMinor + (openingBalances[balance.accountId] ?? 0n),
  }));

  const cashAccountIds = new Set(
    input.accounts
      .filter((account) => account.type === "mobile_money" || account.type === "bank" || account.type === "cash")
      .map((account) => account.accountId),
  );

  const cashBalanceMinor = accountBalances
    .filter((balance) => cashAccountIds.has(balance.accountId))
    .reduce((total, balance) => {
      assertCurrency(balance.currency, input.currency, "cash account");
      return total + balance.balanceMinor;
    }, 0n);

  const cashFlow = calculateCashFlow(input.transactions, input.currency);
  const savings = calculateSavingsMetrics(cashFlow.incomeMinor, cashFlow.expenseMinor);
  const debt = calculateDebtMetrics(cashFlow.incomeMinor, input.debtServiceMinor ?? 0n);

  const assets = input.assets ?? [];
  const liabilities = input.liabilities ?? [];
  const netWorth = calculateNetWorth(
    assets.map((asset) => asset.value),
    liabilities.map((liability) => liability.outstanding),
    input.currency,
  );

  return {
    version: FINANCIAL_SUMMARY_VERSION,
    currency: input.currency,
    accountBalances,
    cashBalanceMinor,
    cashFlow,
    savings,
    debt,
    netWorthMinor: netWorth.netWorthMinor,
    assetsMinor: netWorth.assetsMinor,
    liabilitiesMinor: netWorth.liabilitiesMinor,
  };
}
