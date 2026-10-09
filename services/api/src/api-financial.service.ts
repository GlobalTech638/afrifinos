import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
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
  deriveFinancialSignals,
  buildMerchantProfiles,
  calculateFinancialTrends,
  calculateCategoryTrends,
  calculateSpendingDrivers,
} from "@afrifinos/financial-engine";
import { FINANCIAL_REPOSITORY } from "./app.module.js";

@Injectable()
export class ApiFinancialService {
  constructor(@Inject(FINANCIAL_REPOSITORY) private readonly repository: FinancialRepository) {}

  async getSummary(ownerId: string, currency: CurrencyCode) {
    return (await this.buildSnapshot(ownerId, currency)).summary;
  }

  async getIntelligence(ownerId: string, currency: CurrencyCode) {
    return toFinancialIntelligenceDto(await this.buildSnapshot(ownerId, currency));
  }

  async getAffordability(ownerId: string, currency: CurrencyCode, purchaseAmountMinor: bigint | number | string, additionalRecurringMonthlyMinor: bigint | number | string = 0n) {
    const snapshot = await this.buildSnapshot(ownerId, currency);
    return assessAffordability({ currency, purchaseAmountMinor, additionalRecurringMonthlyMinor, forecast: snapshot.forecast });
  }

  async acknowledgeSignal(ownerId: string, signalId: string) {
    const signal = await this.repository.acknowledgeFinancialSignal(ownerId, signalId);
    if (!signal) throw new NotFoundException("Financial signal not found or already resolved");
    return signal;
  }

  async getSignals(ownerId: string, status?: "active" | "acknowledged" | "resolved") {
    return this.repository.getFinancialSignals(ownerId, status);
  }

  private async buildSnapshot(ownerId: string, currency: CurrencyCode) {
    try {
      const generatedAt = new Date().toISOString();
      const accounts = await this.repository.getAccounts(ownerId);
      const transactions = await this.repository.getTransactions(ownerId);
      const entries = await this.repository.getLedgerEntries(accounts.map((account) => account.accountId));
      const assets = await this.repository.getAssets(ownerId);
      const liabilities = await this.repository.getLiabilities(ownerId);
      const obligations = await this.repository.getObligations(ownerId);
      const goals = await this.repository.getSavingsGoals(ownerId);
      const summary = buildFinancialSummary({ accounts, entries, transactions, assets, liabilities, obligations, goals, currency });
      const temporal = buildTemporalIntelligence(transactions, currency);
      const merchants = buildMerchantProfiles(transactions, currency);
      const trends = calculateFinancialTrends(transactions, currency);
      const categoryTrends = calculateCategoryTrends(transactions, currency);
      const spendingDrivers = calculateSpendingDrivers(categoryTrends);
      const baseline = calculateMonthlyForecastBaseline(temporal.periods);
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
        summary, temporal, merchants, trends, categoryTrends, spendingDrivers, forecast, generatedAt,
      });
      const facts = deriveFinancialFacts(provisional);
      const withFacts = createFinancialIntelligenceSnapshot({
        summary, temporal, merchants, trends, categoryTrends, spendingDrivers, forecast, facts, generatedAt,
      });
      const derivedSignals = deriveFinancialSignals(withFacts);
      const storedSignals = await this.repository.reconcileFinancialSignals(ownerId, derivedSignals);
      const signals = storedSignals.map((signal) => ({
        id: signal.signalId,
        category: signal.category as (typeof derivedSignals)[number]["category"],
        severity: signal.severity,
        status: signal.status,
        title: signal.title,
        statement: signal.statement,
        evidenceIds: signal.evidenceIds,
        detectedAt: signal.lastDetectedAt,
      }));
      return createFinancialIntelligenceSnapshot({
        summary, temporal, merchants, trends, categoryTrends, spendingDrivers, forecast, facts, signals, generatedAt,
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(error instanceof Error ? error.message : "Unable to build financial intelligence");
    }
  }
}
