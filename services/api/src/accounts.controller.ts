import { Controller, Get, Inject } from "@nestjs/common";
import type { FinancialRepository } from "@afrifinos/financial-persistence";
import { FINANCIAL_REPOSITORY } from "./app.module.js";
import { OwnerId } from "./auth-context.js";

@Controller("accounts")
export class AccountsController {
  constructor(
    @Inject(FINANCIAL_REPOSITORY) private readonly repository: FinancialRepository,
  ) {}

  @Get()
  async list(@OwnerId() ownerId: string) {
    return this.repository.getAccounts(ownerId);
  }
}
