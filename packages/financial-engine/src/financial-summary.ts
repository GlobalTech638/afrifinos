import type { Account, Asset, LedgerEntry, Liability, Money, SavingsGoal, Transaction } from "@afrifinos/financial-domain";
import { calculateAccountBalances, calculateNetWorth, type AccountBalance, type NetWorth } from "./balances.js";
import { calculateFinancialHealthScore, type FinancialHealthScore, type HealthScoreInputs } from "./health-score.js";
import { calculateCashFlow, calculateDebtMetrics, calculateSavingsMetrics, type CashFlowSummary, type DebtMetrics, type SavingsMetrics } from "./metrics.js";
import { calculateEmergencyRunway, calculateGoalProgress, calculateSpendingVolatility } from "./resilience.js";

export interface FinancialSummaryInput {
  readonly accounts: readonly Account[];
  readonly entries: readonly LedgerEntry[];
  readonly transactions: readonly Transaction[];
  readonly assets?: readonly Asset[];
  readonly liabilities?: readonly Liability[];
  readonly goals?: readonly SavingsGoal[];
  readonly openingBalances?: ReadonlyMap<string, bigint | number | string>;
  readonly currency: Money["currency"];
  readonly debtServiceMinor?: bigint;
}

export interface FinancialSummary {
  readonly currency: Money["currency"];
  readonly accountBalances: readonly AccountBalance[];
  readonly liquidBalanceMinor: bigint;
  readonly cashFlow: CashFlowSummary;
  readonly savings: SavingsMetrics;
  readonly debt: DebtMetrics;
  readonly netWorth: NetWorth;
  readonly resilience: {
    readonly emergencyRunwayMonths: number | null;
    readonly spendingVolatility: number | null;
    readonly goalProgress: number | null;
  };
  readonly healthInputs: HealthScoreInputs;
  readonly healthScore: FinancialHealthScore;
}

function assertCurrency(value: Money, currency: Money["currency"]): void {
  if (value.currency !== currency) {
    throw new Error(`Currency mismatch: expected ${currency}, received ${value.currency}`);
  }
}

export function buildFinancialSummary(input: FinancialSummaryInput): FinancialSummary {
  const accountBalances = calculateAccountBalances(input.accounts, input.entries, input.openingBalances);
  const liquidAccountIds = new Set(
    input.accounts
      .filter((account) => account.type === "mobile_money" || account.type === "bank" || account.type === "cash")
      .map((account) => account.accountId),
  );
  const liquidBalanceMinor = accountBalances.filter((balance) => liquidAccountIds.has(balance.accountId)).reduce((total, balance) => {
    if (balance.currency !== input.currency) throw new Error(`Currency mismatch: expected ${input.currency}, received ${balance.currency}`);
    return total + balance.balanceMinor;
  }, 0n);

  const incomeTransactionIds = new Set(input.transactions.filter((transaction) => transaction.type === "income").map((transaction) => transaction.transactionId));
  const expenseTransactionIds = new Set(input.transactions.filter((transaction) => transaction.type === "expense" || transaction.type === "fee").map((transaction) => transaction.transactionId));
  const cashFlow = calculateCashFlow(input.entries, incomeTransactionIds, expenseTransactionIds);
  const savings = calculateSavingsMetrics(cashFlow.incomeMinor, cashFlow.expenseMinor);
  const debt = calculateDebtMetrics(cashFlow.incomeMinor, input.debtServiceMinor ?? 0n);

  const assets = [...(input.assets ?? [])].map((asset) => { assertCurrency(asset.value, input.currency); return asset.value; });
  const liabilities = [...(input.liabilities ?? [])].map((liability) => { assertCurrency(liability.outstanding, input.currency); return liability.outstanding; });
  const netWorth = calculateNetWorth(assets, liabilities, input.currency);

  const spendingVolatility = calculateSpendingVolatility(input.transactions, input.currency);
  const averageMonthlyExpenseMinor = calculateAverageMonthlyExpense(input.transactions, input.currency);
  const emergencyRunway = calculateEmergencyRunway(liquidBalanceMinor, averageMonthlyExpenseMinor);
  const goalProgress = calculateGoalProgress(input.goals ?? []);
  const resilience = {
    emergencyRunwayMonths: emergencyRunway.months,
    spendingVolatility: spendingVolatility.normalizedVolatility,
    goalProgress: goalProgress.weightedProgress,
  };
  const healthInputs: HealthScoreInputs = {
    savingsRate: savings.savingsRate,
    debtBurdenRatio: debt.debtBurdenRatio,
    emergencyRunwayMonths: resilience.emergencyRunwayMonths,
    spendingVolatility: resilience.spendingVolatility,
    goalProgress: resilience.goalProgress,
  };

  return { currency: input.currency, accountBalances, liquidBalanceMinor, cashFlow, savings, debt, netWorth, resilience, healthInputs, healthScore: calculateFinancialHealthScore(healthInputs) };
}

function calculateAverageMonthlyExpense(transactions: readonly Transaction[], currency: Money["currency"]): bigint {
  const periods = new Set<string>();
  let total = 0n;
  for (const transaction of transactions) {
    if (transaction.currency !== currency || transaction.type !== "expense") continue;
    const date = new Date(transaction.occurredAt);
    if (Number.isNaN(date.getTime())) continue;
    periods.add(date.toISOString().slice(0, 7));
    total += transaction.total.amountMinor < 0n ? -transaction.total.amountMinor : transaction.total.amountMinor;
  }
  return periods.size > 0 ? total / BigInt(periods.size) : 0n;
}
