import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import type { CurrencyCode } from "@afrifinos/financial-domain";
import { ApiFinancialService } from "./api-financial.service.js";
import { OwnerId } from "./auth-context.js";

@Controller("financial")
export class AffordabilityController {
  constructor(private readonly financial: ApiFinancialService) {}

  @Get("affordability")
  async affordability(
    @OwnerId() ownerId: string,
    @Query("amountMinor") amountMinor: string,
    @Query("currency") currency = "KES",
    @Query("additionalRecurringMonthlyMinor") additionalRecurringMonthlyMinor = "0",
  ) {
    const parsedCurrency = this.parseCurrency(currency);
    if (!/^\d+$/.test(amountMinor ?? "") || BigInt(amountMinor) <= 0n) {
      throw new BadRequestException("amountMinor must be a positive integer in minor currency units");
    }
    if (!/^\d+$/.test(additionalRecurringMonthlyMinor ?? "")) {
      throw new BadRequestException("additionalRecurringMonthlyMinor must be a non-negative integer in minor currency units");
    }

    return this.financial.getAffordability(
      ownerId,
      parsedCurrency,
      amountMinor,
      additionalRecurringMonthlyMinor,
    );
  }

  private parseCurrency(currency: string): CurrencyCode {
    if (!/^[A-Z]{3}$/i.test(currency)) {
      throw new BadRequestException("currency must be a 3-letter ISO-style code");
    }
    return currency.toUpperCase() as CurrencyCode;
  }
}
