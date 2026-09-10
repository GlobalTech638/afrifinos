import type { Money } from "./money.js";

export interface Liability {
  readonly liabilityId: string;
  readonly ownerId: string;
  readonly name: string;
  readonly outstanding: Money;
  readonly liabilityType: "loan" | "credit" | "payable" | "other";
  readonly interestRateAnnual?: number;
  readonly dueAt?: string;
}
