import type { FinancialIntelligenceSnapshot, FinancialSignal } from "./intelligence-contracts.js";

export function deriveFinancialSignals(snapshot: FinancialIntelligenceSnapshot): readonly FinancialSignal[] {
  const detectedAt = snapshot.generatedAt;
  const signals: FinancialSignal[] = [];

  if (snapshot.forecast.liquidityRisk.level === "critical") {
    signals.push({
      id: "liquidity-critical",
      category: "forecast",
      severity: "critical",
      status: "active",
      title: "Critical liquidity risk",
      statement: "Projected liquidity reaches zero or below the safety threshold during the forecast horizon.",
      evidenceIds: ["forecast.liquidityRisk"],
      detectedAt,
    });
  } else if (snapshot.forecast.liquidityRisk.level === "high") {
    signals.push({
      id: "liquidity-high",
      category: "forecast",
      severity: "warning",
      status: "active",
      title: "High liquidity risk",
      statement: "Projected liquidity falls below the configured safety buffer during the forecast horizon.",
      evidenceIds: ["forecast.liquidityRisk"],
      detectedAt,
    });
  }

  const materialIncreases = snapshot.spendingDrivers.filter(
    (driver) => driver.direction === "increase" && driver.contributionRatio !== null && driver.contributionRatio >= 0.25,
  );
  for (const driver of materialIncreases.slice(0, 5)) {
    signals.push({
      id: `spending-driver-${driver.categoryId}`,
      category: "cash_flow",
      severity: driver.contributionRatio >= 0.5 ? "warning" : "info",
      status: "active",
      title: "Major spending driver",
      statement: `Category ${driver.categoryId} accounts for a significant share of the recent spending change.`,
      evidenceIds: [`categoryTrends.${driver.categoryId}`],
      detectedAt,
    });
  }

  return signals;
}
