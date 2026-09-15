import { Controller, Get, Headers, BadRequestException, Inject } from "@nestjs/common";
import type { FinancialRepository } from "@afrifinos/financial-persistence";
import { FINANCIAL_REPOSITORY } from "./app.module.js";

@Controller("accounts")
export class AccountsController {
  constructor(
    @Inject(FINANCIAL_REPOSITORY) private readonly repository: FinancialRepository,
  ) {}

  @Get()
  async list(@Headers("x-owner-id") ownerId?: string) {
    if (!ownerId?.trim()) {
      throw new BadRequestException("x-owner-id header is required until authentication is implemented");
    }
    return this.repository.getAccounts(ownerId.trim());
  }
}
