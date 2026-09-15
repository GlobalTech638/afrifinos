import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { ApiFinancialService } from "./api-financial.service.js";
import type { CurrencyCode } from "@afrifinos/financial-domain";
import { OwnerId } from "./auth-context.js";

@Controller("financial")
export class FinancialController {
  constructor(private readonly financial: ApiFinancialService) {}

  @Get("summary")
  async summary(@OwnerId() ownerId: string, @Query("currency") currency = "KES") {
    return this.financial.getSummary(ownerId, this.parseCurrency(currency));
  }

  @Get("intelligence")
  async intelligence(@OwnerId() ownerId: string, @Query("currency") currency = "KES") {
    return this.financial.getIntelligence(ownerId, this.parseCurrency(currency));
  }

  private parseCurrency(currency: string): CurrencyCode {
    if (!/^[A-Z]{3}$/i.test(currency)) {
      throw new BadRequestException("currency must be a 3-letter ISO-style code");
    }
    return currency.toUpperCase() as CurrencyCode;
  }
}
