import { BadRequestException, Controller, Get, Headers, Query } from "@nestjs/common";
import { ApiFinancialService } from "./api-financial.service.js";
import type { CurrencyCode } from "@afrifinos/financial-domain";

@Controller("financial")
export class FinancialController {
  constructor(private readonly financial: ApiFinancialService) {}

  @Get("summary")
  async summary(
    @Headers("x-owner-id") ownerId: string | undefined,
    @Query("currency") currency = "KES",
  ) {
    if (!ownerId?.trim()) {
      throw new BadRequestException("x-owner-id header is required until authentication is implemented");
    }
    if (!/^[A-Z]{3}$/i.test(currency)) {
      throw new BadRequestException("currency must be a 3-letter ISO-style code");
    }
    return this.financial.getSummary(ownerId.trim(), currency.toUpperCase() as CurrencyCode);
  }
}
