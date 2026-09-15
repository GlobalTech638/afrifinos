import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { ApiFinancialService } from "./api-financial.service.js";
import type { CurrencyCode } from "@afrifinos/financial-domain";
import { OwnerId } from "./auth-context.js";

@Controller("financial")
export class FinancialController {
  constructor(private readonly financial: ApiFinancialService) {}

  @Get("summary")
  async summary(@OwnerId() ownerId: string, @Query("currency") currency = "KES") {
    if (!/^[A-Z]{3}$/i.test(currency)) {
      throw new BadRequestException("currency must be a 3-letter ISO-style code");
    }
    return this.financial.getSummary(ownerId, currency.toUpperCase() as CurrencyCode);
  }
}
