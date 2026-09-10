import type { Money } from "./money.js";
import type { Provenance } from "./provenance.js";

export type TransactionType =
  | "income"
  | "expense"
  | "transfer"
  | "fee"
  | "refund"
  | "reversal"
  | "adjustment";

export type TransactionStatus = "received" | "validated" | "normalized" | "deduplicated" | "posted" | "enriched" | "reconciled";

export interface Transaction {
  readonly transactionId: string;
  readonly ownerId: string;
  readonly type: TransactionType;
  readonly status: TransactionStatus;
  readonly occurredAt: string;
  readonly description?: string;
  readonly counterparty?: string;
  readonly categoryId?: string;
  readonly total: Money;
  readonly provenance: Provenance;
}
