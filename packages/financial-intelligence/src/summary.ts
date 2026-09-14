import type {
  Account,
  Asset,
  CurrencyCode,
  LedgerEntry,
  Liability,
} from "@afrifinos/financial-domain";
import { signedAmount } from "@afrifinos/financial-domain";
import {
  calculateNetWorth,
  calculateAccountBalances,
  calculateCashFlow,
  calculateDebtBurden,
  calculateSavingsRate,
  type AccountBalance,
  type CashFlowMetrics,
  type DebtBurdenMetrics,
} from "@afrifinos/financial-engine";

export const FINANCIAL_SUMMARY_VERSION = "2026-09-v1";

export interface FinancialSummaryInput {
  readonly currency: CurrencyCode;
  readonly accounts: readonly Account[];
  readonly ledgerEntries: readonly LedgerEntry[];
  readonly assets?: readonly Asset[];
  readonly liabilities?: readonly Liability[];
  readonly openingBalancesMinor?: Readonly<Record<string, bigint>>;
}

export interface FinancialSummary {
  readonly version: string;
  readonly currency: CurrencyCode;
  readonly accountBalances: readonly AccountBalance[];
  readonly cashBalanceMinor: bigint;
  readonly cashFlow: CashFlowMetrics;
  readonly savingsRate: number;
  readonly debtBurden: DebtBurdenMetrics;
  readonly netWorthMinor: bigint;
  readonly assetsMinor: bigint;
  readonly liabilitiesMinor: bigint;
}

function assertCurrency(value: CurrencyCode, expected: CurrencyCode, label: string): void {
  if (value !== expected) {
    throw new Error(`Currency mismatch for ${label}: expected ${expected}, received ${value}`);
  }
}

function sumMinor(values: readonly { amountMinor: bigint; currency: CurrencyCode }[], currency: CurrencyCode): bigint {
  return values.reduce((total, value) => {
    assertCurrency(value.currency, currency, "financial summary");
    return total + value.amountMinor;
  }, 0n);
}

export function buildFinancialSummary(input: FinancialSummaryInput): FinancialSummary {
  const openingBalances = input.openingBalancesMinor ?? {};
  const accountBalances = calculateAccountBalances(
    input.accounts,
    input.ledgerEntries,
  ).map((balance) => ({
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
    .reduce((total, balance) => total + balance.balanceMinor, 0n);

  const cashFlow = calculateCashFlow(input.ledgerEntries, input.currency);
  const savingsRate = calculateSavingsRate(cashFlow);
  const debtBurden = calculateDebtBurden(cashFlow);

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
    savingsRate,
    debtBurden,
    netWorthMinor: netWorth.netWorthMinor,
    assetsMinor: netWorth.assetsMinor,
    liabilitiesMinor: netWorth.liabilitiesMinor,
  };
}
