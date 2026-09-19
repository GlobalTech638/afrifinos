import type { CurrencyCode } from "@afrifinos/financial-domain";
import type { CashForecast } from "./forecasting.js";

export type AffordabilityDecision = "affordable" | "caution" | "not_affordable";

export interface AffordabilityInput {
  readonly currency: CurrencyCode;
  readonly purchaseAmountMinor: bigint | number | string;
  readonly forecast: CashForecast;
  readonly additionalRecurringMonthlyMinor?: bigint | number | string;
}

export interface AffordabilityAnalysis {
  readonly currency: CurrencyCode;
  readonly purchaseAmountMinor: bigint;
  readonly additionalRecurringMonthlyMinor: bigint;
  readonly projectedMinimumBalanceMinor: bigint;
  readonly projectedEndingBalanceMinor: bigint;
  readonly safetyBufferMinor: bigint;
  readonly bufferShortfallMinor: bigint;
  readonly decision: AffordabilityDecision;
  readonly reasons: readonly string[];
}

export function assessAffordability(input: AffordabilityInput): AffordabilityAnalysis {
  const purchaseAmountMinor = BigInt(input.purchaseAmountMinor);
  const additionalRecurringMonthlyMinor = BigInt(input.additionalRecurringMonthlyMinor ?? 0);
  if (purchaseAmountMinor <= 0n) throw new Error("Purchase amount must be positive");
  if (additionalRecurringMonthlyMinor < 0n) throw new Error("Additional recurring monthly cost cannot be negative");
  if (input.forecast.currency !== input.currency) throw new Error("Affordability currency mismatch");

  // Model the purchase immediately, then apply the new monthly commitment at each
  // 30-day boundary. This keeps the affordability check aligned with the forecast
  // horizon instead of subtracting one month's cost from every forecasted day.
  let projectedMinimumBalanceMinor = input.forecast.startingBalanceMinor - purchaseAmountMinor;
  let projectedEndingBalanceMinor = input.forecast.endingBalanceMinor - purchaseAmountMinor;
  for (const point of input.forecast.points) {
    const day = Math.round(
      (new Date(point.date).getTime() - new Date(input.forecast.points[0]?.date ?? point.date).getTime()) / 86_400_000,
    ) + 1;
    const recurringCharges = BigInt(Math.floor(day / 30)) * additionalRecurringMonthlyMinor;
    const adjustedBalance = point.projectedBalanceMinor - purchaseAmountMinor - recurringCharges;
    projectedMinimumBalanceMinor = adjustedBalance < projectedMinimumBalanceMinor
      ? adjustedBalance
      : projectedMinimumBalanceMinor;
    if (point === input.forecast.points[input.forecast.points.length - 1]) {
      projectedEndingBalanceMinor = adjustedBalance;
    }
  }

  const safetyBufferMinor = input.forecast.liquidityRisk.safetyBufferMinor;
  const bufferShortfallMinor = safetyBufferMinor > projectedMinimumBalanceMinor
    ? safetyBufferMinor - projectedMinimumBalanceMinor
    : 0n;

  const reasons: string[] = [];
  if (projectedMinimumBalanceMinor <= 0n) {
    reasons.push("The purchase would drive projected liquidity to zero or below during the forecast horizon.");
  } else if (bufferShortfallMinor > 0n) {
    reasons.push("The purchase would reduce projected liquidity below the configured safety buffer.");
  } else {
    reasons.push("The purchase remains above the configured safety buffer across the forecast horizon.");
  }
  if (additionalRecurringMonthlyMinor > 0n) {
    reasons.push("The analysis applies the stated additional cost at monthly intervals across the forecast horizon.");
  }

  const decision: AffordabilityDecision = projectedMinimumBalanceMinor <= 0n
    ? "not_affordable"
    : bufferShortfallMinor > 0n
      ? "caution"
      : "affordable";

  return {
    currency: input.currency,
    purchaseAmountMinor,
    additionalRecurringMonthlyMinor,
    projectedMinimumBalanceMinor,
    projectedEndingBalanceMinor,
    safetyBufferMinor,
    bufferShortfallMinor,
    decision,
    reasons,
  };
}
