import type { CurrencyCode, Transaction } from "@afrifinos/financial-domain";

export interface FinancialTrend {
  readonly key: "monthly_income" | "monthly_expense" | "monthly_net_cash_flow";
  readonly currentMinor: bigint;
  readonly baselineMinor: bigint;
  readonly changeMinor: bigint;
  readonly changeRatio: number | null;
  readonly direction: "up" | "down" | "stable";
}

/**
 * Compares the latest complete observed month with the average of prior
 * observed months. At least three observed months are required so the
 * baseline is not dominated by a single period.
 */
export function calculateFinancialTrends(
  transactions: readonly Transaction[],
  currency: CurrencyCode,
): readonly FinancialTrend[] {
  const months = new Map<string, { income: bigint; expense: bigint }>();
  for (const transaction of transactions) {
    if (transaction.total.currency !== currency || (transaction.type !== "income" && transaction.type !== "expense")) continue;
    const month = transaction.occurredAt.slice(0, 7);
    const bucket = months.get(month) ?? { income: 0n, expense: 0n };
    if (transaction.type === "income") bucket.income += absolute(transaction.total.amountMinor);
    else bucket.expense += absolute(transaction.total.amountMinor);
    months.set(month, bucket);
  }

  const ordered = [...months.entries()].sort(([a], [b]) => a.localeCompare(b));
  if (ordered.length < 3) return [];

  const latest = ordered[ordered.length - 1]?.[1];
  const prior = ordered.slice(0, -1);
  if (!latest || prior.length === 0) return [];

  const baselineIncome = prior.reduce((sum, [, value]) => sum + value.income, 0n) / BigInt(prior.length);
  const baselineExpense = prior.reduce((sum, [, value]) => sum + value.expense, 0n) / BigInt(prior.length);
  const currentNet = latest.income - latest.expense;
  const baselineNet = baselineIncome - baselineExpense;

  return [
    trend("monthly_income", latest.income, baselineIncome),
    trend("monthly_expense", latest.expense, baselineExpense),
    trend("monthly_net_cash_flow", currentNet, baselineNet),
  ];
}

function trend(key: FinancialTrend["key"], currentMinor: bigint, baselineMinor: bigint): FinancialTrend {
  const changeMinor = currentMinor - baselineMinor;
  const magnitude = baselineMinor < 0n ? -baselineMinor : baselineMinor;
  const stableThreshold = magnitude / 20n;
  const direction = changeMinor > stableThreshold ? "up" : changeMinor < -stableThreshold ? "down" : "stable";
  return {
    key,
    currentMinor,
    baselineMinor,
    changeMinor,
    changeRatio: baselineMinor === 0n ? null : ratioOfBigInts(changeMinor, baselineMinor),
    direction,
  };
}

function ratioOfBigInts(numerator: bigint, denominator: bigint): number {\n  const sign = (numerator < 0n) === (denominator < 0n) ? 1 : -1;\n  const n = numerator < 0n ? -numerator : numerator;\n  const d = denominator < 0n ? -denominator : denominator;\n  const ns = n.toString();\n  const ds = d.toString();\n  const precision = 15;\n  const np = Math.min(precision, ns.length);\n  const dp = Math.min(precision, ds.length);\n  return sign * (Number(ns.slice(0, np)) / Number(ds.slice(0, dp))) * 10 ** (ns.length - np - (ds.length - dp));\n}\n\nfunction absolute(value: bigint): bigint {
  return value < 0n ? -value : value;
}

export interface CategoryTrend {
  readonly categoryId: string;
  readonly currentMinor: bigint;
  readonly baselineMinor: bigint;
  readonly changeMinor: bigint;
  readonly changeRatio: number | null;
  readonly direction: "up" | "down" | "stable";
}

export function calculateCategoryTrends(
  transactions: readonly Transaction[],
  currency: CurrencyCode,
): readonly CategoryTrend[] {
  const months = new Map<string, Map<string, bigint>>();
  for (const transaction of transactions) {
    if (transaction.total.currency !== currency || (transaction.type !== "expense" && transaction.type !== "fee") || !transaction.categoryId) continue;
    const month = transaction.occurredAt.slice(0, 7);
    const categories = months.get(month) ?? new Map<string, bigint>();
    categories.set(transaction.categoryId, (categories.get(transaction.categoryId) ?? 0n) + absolute(transaction.total.amountMinor));
    months.set(month, categories);
  }

  const ordered = [...months.entries()].sort(([a], [b]) => a.localeCompare(b));
  if (ordered.length < 3) return [];
  const latest = ordered[ordered.length - 1]?.[1];
  if (!latest) return [];

  const categoryIds = new Set<string>();
  for (const [, categories] of ordered) for (const categoryId of categories.keys()) categoryIds.add(categoryId);

  return [...categoryIds].map((categoryId) => {
    const prior = ordered.slice(0, -1);
    const baselineMinor = prior.reduce((sum, [, categories]) => sum + (categories.get(categoryId) ?? 0n), 0n) / BigInt(prior.length);
    return categoryTrend(categoryId, latest.get(categoryId) ?? 0n, baselineMinor);
  }).sort((a, b) => {
    const aa = a.changeMinor < 0n ? -a.changeMinor : a.changeMinor;
    const bb = b.changeMinor < 0n ? -b.changeMinor : b.changeMinor;
    return aa === bb ? a.categoryId.localeCompare(b.categoryId) : aa > bb ? -1 : 1;
  });
}

function categoryTrend(categoryId: string, currentMinor: bigint, baselineMinor: bigint): CategoryTrend {
  const changeMinor = currentMinor - baselineMinor;
  const magnitude = baselineMinor < 0n ? -baselineMinor : baselineMinor;
  const threshold = magnitude / 20n;
  const direction = changeMinor > threshold ? "up" : changeMinor < -threshold ? "down" : "stable";
  return {
    categoryId,
    currentMinor,
    baselineMinor,
    changeMinor,
    changeRatio: baselineMinor === 0n ? null : ratioOfBigInts(changeMinor, baselineMinor),
    direction,
  };
}

export interface SpendingDriver {
  readonly categoryId: string;
  readonly changeMinor: bigint;
  readonly contributionRatio: number | null;
  readonly direction: "increase" | "decrease";
}

export function calculateSpendingDrivers(categoryTrends: readonly CategoryTrend[]): readonly SpendingDriver[] {
  const changed = categoryTrends.filter((trend) => trend.changeMinor !== 0n);
  const totalAbsoluteChange = changed.reduce((sum, trend) => {
    const value = trend.changeMinor < 0n ? -trend.changeMinor : trend.changeMinor;
    return sum + value;
  }, 0n);

  return changed
    .map((trend) => ({
      categoryId: trend.categoryId,
      changeMinor: trend.changeMinor,
      contributionRatio: totalAbsoluteChange === 0n ? null : ratioOfBigInts(
        trend.changeMinor < 0n ? -trend.changeMinor : trend.changeMinor,
        totalAbsoluteChange,
      ),
      direction: trend.changeMinor > 0n ? "increase" : "decrease",
    }))
    .sort((a, b) => {
      const aa = a.changeMinor < 0n ? -a.changeMinor : a.changeMinor;
      const bb = b.changeMinor < 0n ? -b.changeMinor : b.changeMinor;
      return aa === bb ? a.categoryId.localeCompare(b.categoryId) : aa > bb ? -1 : 1;
    });
}
