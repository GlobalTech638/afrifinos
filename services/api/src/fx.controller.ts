import { BadRequestException, Controller, Get, Inject, InternalServerErrorException, Query } from "@nestjs/common";
import type { FinancialRepository, FxConversionRecord } from "@afrifinos/financial-persistence";
import { FINANCIAL_REPOSITORY } from "./app.module.js";
import { OwnerId } from "./auth-context.js";

interface FxHistoryRepository extends FinancialRepository {
  getFxConversions(ownerId: string, limit?: number): Promise<readonly FxConversionRecord[]>;
}

@Controller("fx")
export class FxController {
  constructor(
    @Inject(FINANCIAL_REPOSITORY) private readonly repository: FxHistoryRepository,
  ) {}

  @Get("conversions")
  async listConversions(@OwnerId() ownerId: string, @Query("limit") rawLimit?: string) {
    let limit = 50;
    if (rawLimit !== undefined) {
      if (!/^\\d+$/.test(rawLimit.trim())) throw new BadRequestException("limit must be an integer between 1 and 100");
      limit = Number(rawLimit);
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
        throw new BadRequestException("limit must be an integer between 1 and 100");
      }
    }

    try {
      return await this.repository.getFxConversions(ownerId, limit);
    } catch {
      throw new InternalServerErrorException("Unable to retrieve FX conversion history");
    }
  }
}
