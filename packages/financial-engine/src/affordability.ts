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

function parseMinorUnits(value: bigint | number | string, field: string): bigint {
  if (typeof value === "number" && !Number.isSafeInteger(value)) {
    throw new Error(`${field} must be a safe integer when provided as a number`);
  }
  try {
    return BigInt(value);
  } catch {
    throw new Error(`${field} must be an integer amount in minor currency units`);
  }
}

export function assessAffordability(input: AffordabilityInput): AffordabilityAnalysis {
  const purchaseAmountMinor = parseMinorUnits(input.purchaseAmountMinor, "Purchase amount");
  const additionalRecurringMonthlyMinor = parseMinorUnits(input.additionalRecurringMonthlyMinor ?? 0, "Additional recurring monthly cost");
  if (purchaseAmountMinor <= 0n) throw new Error("Purchase amount must be positive");
  if (additionalRecurringMonthlyMinor < 0n) throw new Error("Additional recurring monthly cost cannot be negative");
  if (input.forecast.currency !== input.currency) throw new Error("Affordability currency mismatch");

  const monthlyPeriods = BigInt(Math.floor(input.forecast.horizonDays / 30));
  let projectedMinimumBalanceMinor = input.forecast.minimumProjectedBalanceMinor
    - purchaseAmountMinor
    - additionalRecurringMonthlyMinor;
  let projectedEndingBalanceMinor = input.forecast.endingBalanceMinor
    - purchaseAmountMinor
    - additionalRecurringMonthlyMinor * monthlyPeriods;

  const firstPointDate = input.forecast.points[0]?.date;
  for (let index = 0; index < input.forecast.points.length; index += 1) {
    const point = input.forecast.points[index];
    if (!point) continue;
    const day = firstPointDate
      ? Math.round((new Date(point.date).getTime() - new Date(firstPointDate).getTime()) / 86_400_000) + 1
      : index + 1;
    const recurringCharges = BigInt(Math.floor(day / 30)) * additionalRecurringMonthlyMinor;
    const adjustedBalance = point.projectedBalanceMinor - purchaseAmountMinor - recurringCharges;
    if (adjustedBalance < projectedMinimumBalanceMinor) projectedMinimumBalanceMinor = adjustedBalance;
    if (index === input.forecast.points.length - 1) projectedEndingBalanceMinor = adjustedBalance;
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
    reasons.push("The analysis applies the stated additional monthly commitment across the forecast horizon.");
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
