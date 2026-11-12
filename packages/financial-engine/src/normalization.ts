import { currencyCode, getCurrencyDefinition, type CurrencyCode } from "@afrifinos/financial-domain";

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
  if (typeof input.description !== "string") throw new Error("Transaction description must be a string");
  const description = input.description.trim().replace(/\s+/g, " ");
  if (!description) throw new Error("Transaction description cannot be empty");
  if (typeof input.amountMinor === "number" && !Number.isSafeInteger(input.amountMinor)) {
    throw new Error("Transaction amount must be a safe integer when provided as a number");
  }
  let amountMinor: bigint;
  try {
    amountMinor = BigInt(input.amountMinor);
  } catch {
    throw new Error("Transaction amount must be an integer in minor currency units");
  }
  if (amountMinor === 0n) throw new Error("Transaction amount cannot be zero");
  const occurredAt = new Date(input.occurredAt);
  if (Number.isNaN(occurredAt.getTime())) throw new Error("Transaction date must be valid");
  let parsedCurrency: CurrencyCode;
  try {
    parsedCurrency = currencyCode(input.currency);
    getCurrencyDefinition(parsedCurrency);
  } catch {
    throw new Error("Transaction currency is not supported");
  }

  const type = input.type ?? inferTransactionType(description, amountMinor);
  return {
    ...(input.externalId ? { externalId: input.externalId } : {}),
    occurredAt: occurredAt.toISOString(),
    description,
    amountMinor,
    currency: parsedCurrency,
    type,
    ...(input.counterparty?.trim() ? { counterparty: input.counterparty.trim() } : {}),
  };
}

export function inferTransactionType(description: string, amountMinor: bigint | number | string): NormalizedTransactionType {
  if (refundPatterns.some((pattern) => pattern.test(description))) return /refund/i.test(description) ? "refund" : "reversal";
  if (feePatterns.some((pattern) => pattern.test(description))) return "fee";
  if (transferPatterns.some((pattern) => pattern.test(description))) return "transfer";
  if (incomePatterns.some((pattern) => pattern.test(description))) return "income";
  return BigInt(amountMinor) >= 0n ? "expense" : "income";
}
