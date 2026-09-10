import type { CurrencyCode } from "./currency.js";

export type AccountType =
  | "mobile_money"
  | "bank"
  | "cash"
  | "sacco"
  | "investment"
  | "loan"
  | "other";

export type AccountStatus = "active" | "archived";

export interface Account {
  readonly accountId: string;
  readonly ownerId: string;
  readonly name: string;
  readonly type: AccountType;
  readonly currency: CurrencyCode;
  readonly status: AccountStatus;
  readonly providerId?: string;
  readonly externalAccountId?: string;
  readonly openedAt?: string;
  readonly archivedAt?: string;
}
