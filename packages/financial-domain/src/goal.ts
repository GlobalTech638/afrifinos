import type { Money } from "./money.js";

export interface SavingsGoal {
  readonly goalId: string;
  readonly ownerId: string;
  readonly name: string;
  readonly target: Money;
  readonly current: Money;
  readonly targetAt?: string;
  readonly status: "active" | "completed" | "paused" | "cancelled";
}
