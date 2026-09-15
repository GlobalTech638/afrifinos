import type { CurrencyCode, Liability, Obligation, Transaction } from "@afrifinos/financial-domain";
import { ratioOfBigInts } from "./metrics.js";

export interface DebtServiceAnalysis {
  readonly currency: CurrencyCode;
  readonly recurringDebtServiceMinor: bigint;
  readonly obligationDebtServiceMinor: bigint;
  readonly transactionDebtServiceMinor: bigint;
  readonly estimatedMonthlyDebtServiceMinor: bigint;
  readonly debtBurdenRatio: number | null;
  readonly sourceCount: number;
}

/**
 * Estimates monthly debt service from explicit debt obligations and observed
 * recurring debt payments. Transactions are only used when they are explicitly
 * categorized as debt, avoiding inference from arbitrary merchant names.
 */
export function calculateDebtService(
  currency: CurrencyCode,
  incomeMinor: bigint,
  liabilities: readonly Liability[],
  obligations: readonly Obligation[],
  transactions: readonly Transaction[],
): DebtServiceAnalysis {
  const obligationDebtServiceMinor = obligations.reduce((total, obligation) => {
    if (obligation.status !== "active" || obligation.amount.currency !== currency) return total;
    if (!obligation.recurring || !obligation.dueAt) return total;
    const monthlyAmount = monthlyEquivalent(obligation.amount.amountMinor, obligation.recurrence ?? "monthly");
    return total + monthlyAmount;
  }, 0n);

  const transactionDebtServiceMinor = transactions.reduce((total, transaction) => {
    if (transaction.currency !== currency || transaction.type !== "expense" || transaction.categoryId !== "debt") return total;
    return total + absolute(transaction.total.amountMinor);
  }, 0n);

  const recurringDebtServiceMinor = liabilities.reduce((total, liability) => {
    if (liability.outstanding.currency !== currency) return total;
    return total;
  }, 0n);

  const estimatedMonthlyDebtServiceMinor = recurringDebtServiceMinor + obligationDebtServiceMinor + transactionDebtServiceMinor;

  return {
    currency,
    recurringDebtServiceMinor,
    obligationDebtServiceMinor,
    transactionDebtServiceMinor,
    estimatedMonthlyDebtServiceMinor,
    debtBurdenRatio: incomeMinor > 0n ? ratioOfBigInts(estimatedMonthlyDebtServiceMinor, incomeMinor) : null,
    sourceCount: Number(Boolean(obligationDebtServiceMinor)) + Number(Boolean(transactionDebtServiceMinor)),
  };
}

function monthlyEquivalent(amountMinor: bigint, recurrence: NonNullable<Obligation["recurrence"]>): bigint {
  const amount = absolute(amountMinor);
  switch (recurrence) {
    case "weekly": return (amount * 52n) / 12n;
    case "biweekly": return (amount * 26n) / 12n;
    case "monthly": return amount;
    case "quarterly": return amount / 3n;
    case "annual": return amount / 12n;
    case "once": return 0n;
  }
}

function absolute(value: bigint): bigint {
  return value < 0n ? -value : value;
}
