import type { CurrencyCode, Transaction } from "@afrifinos/financial-domain";

export interface MerchantProfile {
  readonly merchantKey: string;
  readonly displayName: string;
  readonly currency: CurrencyCode;
  readonly transactionCount: number;
  readonly totalSpendMinor: bigint;
  readonly averageSpendMinor: bigint;
  readonly lastObservedAt: string;
  readonly categoryIds: readonly string[];
}

function normalizeMerchant(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function displayName(transaction: Transaction): string {
  return (transaction.counterparty ?? transaction.description ?? "Unknown merchant").trim();
}

function amount(transaction: Transaction): bigint {
  return transaction.total.amountMinor < 0n ? -transaction.total.amountMinor : transaction.total.amountMinor;
}

/**
 * Builds deterministic merchant memory from observed expense transactions.
 * This is intentionally derived from the ledger rather than stored as an
 * authoritative financial fact.
 */
export function buildMerchantProfiles(
  transactions: readonly Transaction[],
  currency: CurrencyCode,
): readonly MerchantProfile[] {
  const groups = new Map<string, Transaction[]>();

  for (const transaction of transactions) {
    if (transaction.total.currency !== currency || transaction.type !== "expense") continue;
    const merchantKey = normalizeMerchant(transaction.counterparty ?? transaction.description ?? "");
    if (!merchantKey) continue;
    const group = groups.get(merchantKey) ?? [];
    group.push(transaction);
    groups.set(merchantKey, group);
  }

  return [...groups.entries()]
    .map(([merchantKey, group]) => {
      const ordered = [...group].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
      const totalSpendMinor = group.reduce((sum, transaction) => sum + amount(transaction), 0n);
      const categoryIds = [...new Set(group.map((transaction) => transaction.categoryId).filter((id): id is string => Boolean(id)))].sort();
      const latest = ordered[ordered.length - 1];
      if (!latest) throw new Error("Merchant group unexpectedly empty");

      return {
        merchantKey,
        displayName: displayName(latest),
        currency,
        transactionCount: group.length,
        totalSpendMinor,
        averageSpendMinor: totalSpendMinor / BigInt(group.length),
        lastObservedAt: latest.occurredAt,
        categoryIds,
      };
    })
    .sort((a, b) => {
      if (a.totalSpendMinor === b.totalSpendMinor) return a.merchantKey.localeCompare(b.merchantKey);
      return a.totalSpendMinor > b.totalSpendMinor ? -1 : 1;
    });
}
