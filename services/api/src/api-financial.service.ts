import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { CurrencyCode } from "@afrifinos/financial-domain";
import type { FinancialRepository } from "@afrifinos/financial-persistence";
import {
  buildFinancialSummary,
  buildTemporalIntelligence,
  calculateMonthlyForecastBaseline,
  createFinancialIntelligenceSnapshot,
  forecastCashFlow,
  toFinancialIntelligenceDto,
  deriveFinancialFacts,
} from "@afrifinos/financial-engine";
import { FINANCIAL_REPOSITORY } from "./app.module.js";

@Injectable()
export class ApiFinancialService {
  constructor(
    @Inject(FINANCIAL_REPOSITORY) private readonly repository: FinancialRepository,
  ) {}

  async getSummary(ownerId: string, currency: CurrencyCode) {
    return this.buildSnapshot(ownerId, currency).then((snapshot) => snapshot.summary);
  }

  async getIntelligence(ownerId: string, currency: CurrencyCode) {
    const snapshot = await this.buildSnapshot(ownerId, currency);
    return toFinancialIntelligenceDto(snapshot);
  }

  private async buildSnapshot(ownerId: string, currency: CurrencyCode) {
    try {
      const generatedAt = new Date().toISOString();
      const accounts = await this.repository.getAccounts(ownerId);
      const transactions = await this.repository.getTransactions(ownerId);
      const accountIds = accounts.map((account) => account.accountId);
      const entries = await this.repository.getLedgerEntries(accountIds);
      const assets = await this.repository.getAssets(ownerId);
      const liabilities = await this.repository.getLiabilities(ownerId);
      const obligations = await this.repository.getObligations(ownerId);
      const goals = await this.repository.getSavingsGoals(ownerId);

      const summary = buildFinancialSummary({
        accounts,
        entries,
        transactions,
        assets,
        liabilities,
        obligations,
        goals,
        currency,
      });

      const temporal = buildTemporalIntelligence(transactions, currency);
      const baseline = calculateMonthlyForecastBaseline(temporal.periods);
      // One month of observed average expenses is the initial deterministic safety buffer.
      // A future policy layer can replace this with user-specific or risk-tiered buffers.
      const forecast = forecastCashFlow({
        currency,
        startingBalanceMinor: summary.liquidBalanceMinor,
        averageMonthlyIncomeMinor: baseline.averageMonthlyIncomeMinor,
        averageMonthlyExpenseMinor: baseline.averageMonthlyExpenseMinor,
        recurring: temporal.recurring,
        obligations,
        safetyBufferMinor: baseline.averageMonthlyExpenseMinor,
        asOf: generatedAt,
      });

      const provisional = createFinancialIntelligenceSnapshot({
        summary,
        temporal,
        forecast,
        generatedAt,
      });
      const facts = deriveFinancialFacts(provisional);

      return createFinancialIntelligenceSnapshot({
        summary,
        temporal,
        forecast,
        facts,
        generatedAt,
      });
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Unable to build financial intelligence",
      );
    }
  }
}
