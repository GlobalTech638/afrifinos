import type { FinancialFact, FinancialIntelligenceSnapshot, FinancialAdviceResponse } from "./intelligence-contracts.js";
import { INTELLIGENCE_SCHEMA_VERSION } from "./intelligence-contracts.js";

export interface AiAnalystProvider {
  readonly name: string;
  analyze(snapshot: FinancialIntelligenceSnapshot): Promise<FinancialAdviceResponse>;
}

function fact(
  id: string,
  category: FinancialFact["category"],
  statement: string,
  severity: FinancialFact["severity"],
  evidence: readonly string[],
): FinancialFact {
  return { id, category, statement, severity, evidence };
}

export function deriveFinancialFacts(snapshot: FinancialIntelligenceSnapshot): readonly FinancialFact[] {
  const facts: FinancialFact[] = [];
  const { summary, forecast } = snapshot;
  const liquidityRisk = forecast.liquidityRisk;

  if (summary.savings.savingsRate !== null && summary.savings.savingsRate < 0) {
    facts.push(fact("savings-negative", "savings", "Spending is currently higher than recorded income.", "critical", ["summary.savings.savingsRate"]));
  }

  if (summary.debt.debtBurdenRatio !== null && summary.debt.debtBurdenRatio >= 0.4) {
    facts.push(fact("debt-high-burden", "debt", "Debt service is consuming a high share of recorded income.", "warning", ["summary.debt.debtBurdenRatio"]));
  }

  if (liquidityRisk.level === "critical" || liquidityRisk.level === "high" || liquidityRisk.level === "watch") {
    facts.push(fact(
      "liquidity-risk",
      "liquidity",
      liquidityRisk.level === "critical"
        ? "Projected liquidity falls below zero within the forecast horizon."
        : liquidityRisk.level === "high"
          ? "Projected liquidity falls below the defined safety buffer."
          : "Projected liquidity is approaching the defined safety buffer.",
      liquidityRisk.level === "critical" ? "critical" : liquidityRisk.level === "high" ? "warning" : "warning",
      ["forecast.liquidityRisk", "forecast.minimumProjectedBalanceMinor"],
    ));
  }

  if (forecast.minimumProjectedBalanceMinor < 0n) {
    facts.push(fact("forecast-negative-balance", "forecast", "The current forecast projects a negative cash balance within the selected horizon.", "critical", ["forecast.minimumProjectedBalanceMinor", "forecast.runwayDays"]));
  }

  for (const anomaly of snapshot.temporal.anomalies.slice(0, 5)) {
    facts.push(fact(`anomaly-${anomaly.transactionId}`, "anomaly", `Transaction ${anomaly.transactionId} is unusually large relative to its baseline.`, "warning", [`temporal.anomalies.${anomaly.transactionId}`]));
  }

  for (const recurring of snapshot.temporal.recurring.slice(0, 10)) {
    if (recurring.type === "expense") {
      facts.push(fact(`recurring-${recurring.key}`, "recurring", `A recurring expense is detected approximately every ${recurring.averageIntervalDays} days.`, "info", [`temporal.recurring.${recurring.key}`]));
    }
  }

  if (facts.length === 0) {
    facts.push(fact("financial-state-no-alerts", "health", "No high-priority financial alerts were detected by the current deterministic rules.", "info", ["summary.healthScore"]));
  }

  return facts;
}

export function createRuleBasedAnalyst(): AiAnalystProvider {
  return {
    name: "deterministic-rule-analyst",
    async analyze(snapshot) {
      const facts = deriveFinancialFacts(snapshot);
      return {
        schemaVersion: INTELLIGENCE_SCHEMA_VERSION,
        generatedAt: new Date().toISOString(),
        advice: facts
          .filter((item) => item.severity !== "info")
          .map((item) => ({
            id: `advice-${item.id}`,
            priority: item.severity === "critical" ? "high" as const : "medium" as const,
            riskLevel: item.severity === "critical" ? "high" as const : "medium" as const,
            title: item.category === "debt" ? "Review debt burden" : item.category === "liquidity" ? "Protect liquidity" : item.category === "forecast" ? "Protect upcoming cash" : "Review financial alert",
            explanation: item.statement,
            evidenceIds: [item.id],
            action: item.category === "debt"
              ? "Review debt payments and prioritize reducing expensive or urgent obligations."
              : item.category === "liquidity"
                ? "Review upcoming obligations and recurring expenses, then preserve enough liquid cash to remain above the safety buffer."
                : item.category === "forecast"
                  ? "Review upcoming recurring expenses and preserve enough liquid cash to avoid a shortfall."
                  : "Review the underlying transactions and confirm whether the alert reflects a real financial change.",
          })),
      };
    },
  };
}
