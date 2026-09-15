import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { CurrencyCode } from "@afrifinos/financial-domain";
import type { FinancialRepository } from "@afrifinos/financial-persistence";
import {
  buildFinancialSummary,
  buildTemporalIntelligence,
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
      const accounts = await this.repository.getAccounts(ownerId);
      const transactions = await this.repository.getTransactions(ownerId);
      const accountIds = accounts.map((account) => account.accountId);
      const entries = await this.repository.getLedgerEntries(accountIds);
      const assets = await this.repository.getAssets(ownerId);
      const liabilities = await this.repository.getLiabilities(ownerId);

      const summary = buildFinancialSummary({
        accounts,
        entries,
        transactions,
        assets,
        liabilities,
        currency,
      });

      const temporal = buildTemporalIntelligence(transactions, currency);
      const forecast = forecastCashFlow({
        currency,
        startingBalanceMinor: summary.liquidBalanceMinor,
        averageMonthlyIncomeMinor: summary.cashFlow.incomeMinor,
        averageMonthlyExpenseMinor: summary.cashFlow.expenseMinor,
        recurring: temporal.recurring,
      });

      const provisional = createFinancialIntelligenceSnapshot({
        summary,
        temporal,
        forecast,
      });
      const facts = deriveFinancialFacts(provisional);

      return createFinancialIntelligenceSnapshot({
        summary,
        temporal,
        forecast,
        facts,
        generatedAt: provisional.generatedAt,
      });
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Unable to build financial intelligence",
      );
    }
  }
}
