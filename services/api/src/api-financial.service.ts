import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { CurrencyCode } from "@afrifinos/financial-domain";
import type { FinancialRepository } from "@afrifinos/financial-persistence";
import { buildFinancialSummary } from "@afrifinos/financial-engine";
import { FINANCIAL_REPOSITORY } from "./app.module.js";

@Injectable()
export class ApiFinancialService {
  constructor(
    @Inject(FINANCIAL_REPOSITORY) private readonly repository: FinancialRepository,
  ) {}

  async getSummary(ownerId: string, currency: CurrencyCode) {
    const accounts = await this.repository.getAccounts(ownerId);
    const transactions = await this.repository.getTransactions(ownerId);
    const accountIds = accounts.map((account) => account.accountId);
    const entries = await this.repository.getLedgerEntries(accountIds);
    const assets = await this.repository.getAssets(ownerId);
    const liabilities = await this.repository.getLiabilities(ownerId);

    try {
      return buildFinancialSummary({
        accounts,
        entries,
        transactions,
        assets,
        liabilities,
        currency,
      });
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Unable to build financial summary",
      );
    }
  }
}
