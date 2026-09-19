import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { CurrencyCode } from "@afrifinos/financial-domain";
import type { FinancialRepository } from "@afrifinos/financial-persistence";
import {
  assessAffordability,
  buildFinancialSummary,
  buildTemporalIntelligence,
  calculateMonthlyForecastBaseline,
  createFinancialIntelligenceSnapshot,
  forecastCashFlow,
  toFinancialIntelligenceDto,
  deriveFinancialFacts,
  buildMerchantProfiles,
  calculateFinancialTrends,
  calculateCategoryTrends,
  calculateSpendingDrivers,
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

  async getAffordability(
    ownerId: string,
    currency: CurrencyCode,
    purchaseAmountMinor: bigint | number | string,
    additionalRecurringMonthlyMinor: bigint | number | string = 0n,
  ) {
    const snapshot = await this.buildSnapshot(ownerId, currency);
    return assessAffordability({
      currency,
      purchaseAmountMinor,
      additionalRecurringMonthlyMinor,
      forecast: snapshot.forecast,
    });
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
      const merchants = buildMerchantProfiles(transactions, currency);
      const trends = calculateFinancialTrends(transactions, currency);
      const categoryTrends = calculateCategoryTrends(transactions, currency);
      const spendingDrivers = calculateSpendingDrivers(categoryTrends);
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
        merchants,
        trends,
        categoryTrends,
        spendingDrivers,
        forecast,
        generatedAt,
      });
      const facts = deriveFinancialFacts(provisional);

      return createFinancialIntelligenceSnapshot({
        summary,
        temporal,
        merchants,
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
