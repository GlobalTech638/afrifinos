import type { CurrencyCode } from "@afrifinos/financial-domain";

export type NormalizedTransactionType = "income" | "expense" | "transfer" | "fee" | "refund" | "reversal" | "adjustment";

export interface RawTransaction {
  readonly externalId?: string;
  readonly occurredAt: string;
  readonly description: string;
  readonly amountMinor: bigint | number | string;
  readonly currency: CurrencyCode;
  readonly type?: NormalizedTransactionType;
  readonly counterparty?: string;
}

export interface NormalizedTransaction {
  readonly externalId?: string;
  readonly occurredAt: string;
  readonly description: string;
  readonly amountMinor: bigint;
  readonly currency: CurrencyCode;
  readonly type: NormalizedTransactionType;
  readonly counterparty?: string;
}

const incomePatterns = [/salary/i, /wage/i, /payroll/i, /deposit/i, /received/i, /payment from/i, /dividend/i];
const transferPatterns = [/transfer/i, /till/i, /paybill/i, /sent to/i, /send money/i, /withdraw/i, /deposit to/i];
const feePatterns = [/fee/i, /charge/i, /commission/i, /levy/i, /excise/i];
const refundPatterns = [/refund/i, /reversal/i, /reverted/i, /cashback/i];

export function normalizeTransaction(input: RawTransaction): NormalizedTransaction {
  const description = input.description.trim().replace(/\s+/g, " ");
  if (!description) throw new Error("Transaction description cannot be empty");

  const type = input.type ?? inferTransactionType(description, input.amountMinor);
  return {
    externalId: input.externalId,
    occurredAt: new Date(input.occurredAt).toISOString(),
    description,
    amountMinor: BigInt(input.amountMinor),
    currency: input.currency,
    type,
    counterparty: input.counterparty?.trim() || undefined,
  };
}

export function inferTransactionType(description: string, amountMinor: bigint | number | string): NormalizedTransactionType {
  if (refundPatterns.some((pattern) => pattern.test(description))) return /refund/i.test(description) ? "refund" : "reversal";
  if (feePatterns.some((pattern) => pattern.test(description))) return "fee";
  if (transferPatterns.some((pattern) => pattern.test(description))) return "transfer";
  if (incomePatterns.some((pattern) => pattern.test(description))) return "income";
  return BigInt(amountMinor) >= 0n ? "expense" : "income";
}
