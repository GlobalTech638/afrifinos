import type { Money } from "./money.js";

export type ObligationStatus = "active" | "settled" | "cancelled";
export type ObligationRecurrence = "once" | "weekly" | "biweekly" | "monthly" | "quarterly" | "annual";
export type ObligationKind = "debt_service" | "rent" | "utility" | "subscription" | "education" | "insurance" | "tax" | "goal_contribution" | "other";

export interface Obligation {
  readonly obligationId: string;
  readonly ownerId: string;
  readonly name: string;
  readonly amount: Money;
  readonly dueAt?: string;
  readonly status: ObligationStatus;
  readonly recurring: boolean;
  readonly recurrence?: ObligationRecurrence;
  readonly kind?: ObligationKind;
  readonly liabilityId?: string;
}
