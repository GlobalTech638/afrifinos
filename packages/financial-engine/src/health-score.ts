export interface HealthScoreInputs {
  readonly savingsRate: number | null;
  readonly debtBurdenRatio: number | null;
  readonly emergencyRunwayMonths: number | null;
  readonly spendingVolatility: number | null;
  readonly goalProgress: number | null;
}

export interface HealthScoreComponent {
  readonly key: keyof HealthScoreInputs;
  readonly score: number;
  readonly weight: number;
  readonly contribution: number;
}

export interface FinancialHealthScore {
  readonly score: number;
  readonly band: "critical" | "fragile" | "stable" | "strong";
  readonly methodologyVersion: string;
  readonly components: readonly HealthScoreComponent[];
}

const VERSION = "2026-09-v1";

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function savingsScore(rate: number | null): number {
  if (rate === null) return 0.5;
  return clamp((rate + 0.10) / 0.30);
}

function debtScore(ratio: number | null): number {
  if (ratio === null) return 0.5;
  return clamp(1 - ratio / 0.50);
}

function runwayScore(months: number | null): number {
  if (months === null) return 0.5;
  return clamp(months / 6);
}

function volatilityScore(volatility: number | null): number {
  if (volatility === null) return 0.5;
  return clamp(1 - volatility);
}

function goalScore(progress: number | null): number {
  if (progress === null) return 0.5;
  return clamp(progress);
}

export function calculateFinancialHealthScore(inputs: HealthScoreInputs): FinancialHealthScore {
  const definitions: readonly [keyof HealthScoreInputs, number, number][] = [
    ["savingsRate", savingsScore(inputs.savingsRate), 0.25],
    ["debtBurdenRatio", debtScore(inputs.debtBurdenRatio), 0.25],
    ["emergencyRunwayMonths", runwayScore(inputs.emergencyRunwayMonths), 0.20],
    ["spendingVolatility", volatilityScore(inputs.spendingVolatility), 0.15],
    ["goalProgress", goalScore(inputs.goalProgress), 0.15],
  ];

  const components = definitions.map(([key, score, weight]) => ({
    key,
    score,
    weight,
    contribution: score * weight,
  }));

  const score = Math.round(
    components.reduce((total, component) => total + component.contribution, 0) * 100,
  );

  const band = score < 40
    ? "critical"
    : score < 60
      ? "fragile"
      : score < 80
        ? "stable"
        : "strong";

  return { score, band, methodologyVersion: VERSION, components };
}
