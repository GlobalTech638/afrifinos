import type { Account, LedgerEntry, Money } from "@afrifinos/financial-domain";
import { signedAmount } from "@afrifinos/financial-domain";

export interface AccountBalance {
  readonly accountId: string;
  readonly currency: Money["currency"];
  readonly balanceMinor: bigint;
}

export function calculateAccountBalance(
  accountId: string,
  entries: readonly LedgerEntry[],
  currency?: Money["currency"],
  openingBalanceMinor: bigint | number | string = 0n,
): AccountBalance {
  let balanceMinor = BigInt(openingBalanceMinor);
  let detectedCurrency: Money["currency"] | undefined = currency;

  for (const entry of entries) {
    if (entry.accountId !== accountId) continue;
    if (detectedCurrency && detectedCurrency !== entry.currency) {
      throw new Error(`Currency mismatch for account ${accountId}: ${detectedCurrency} != ${entry.currency}`);
    }
    detectedCurrency = entry.currency;
    balanceMinor += signedAmount(entry);
  }

  if (!detectedCurrency) throw new Error(`No currency available for account ${accountId}`);
  return { accountId, currency: detectedCurrency, balanceMinor };
}

export function calculateAccountBalances(
  accounts: readonly Account[],
  entries: readonly LedgerEntry[],
  openingBalances: ReadonlyMap<string, bigint | number | string> = new Map(),
): readonly AccountBalance[] {
  return accounts.map((account) => calculateAccountBalance(
    account.accountId,
    entries,
    account.currency,
    openingBalances.get(account.accountId) ?? 0n,
  ));
}

export interface NetWorth {
  readonly currency: Money["currency"];
  readonly assetsMinor: bigint;
  readonly liabilitiesMinor: bigint;
  readonly netWorthMinor: bigint;
}

export function calculateNetWorth(
  assets: readonly Money[],
  liabilities: readonly Money[],
  currency: Money["currency"],
): NetWorth {
  const sum = (values: readonly Money[]): bigint => values.reduce((total, value) => {
    if (value.currency !== currency) throw new Error(`Currency mismatch: expected ${currency}, received ${value.currency}`);
    return total + value.amountMinor;
  }, 0n);

  const assetsMinor = sum(assets);
  const liabilitiesMinor = sum(liabilities);
  return { currency, assetsMinor, liabilitiesMinor, netWorthMinor: assetsMinor - liabilitiesMinor };
}
