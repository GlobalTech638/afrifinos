import { BadRequestException, Body, Controller, Get, Inject, Post } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Account, AccountType, CurrencyCode } from "@afrifinos/financial-domain";
import type { FinancialRepository } from "@afrifinos/financial-persistence";
import { FINANCIAL_REPOSITORY } from "./app.module.js";
import { OwnerId } from "./auth-context.js";

interface CreateAccountBody {
  readonly name: string;
  readonly type: AccountType;
  readonly currency?: string;
}

const ACCOUNT_TYPES = new Set<AccountType>([
  "mobile_money", "bank", "cash", "sacco", "investment", "loan", "other",
]);

@Controller("accounts")
export class AccountsController {
  constructor(
    @Inject(FINANCIAL_REPOSITORY) private readonly repository: FinancialRepository,
  ) {}

  @Get()
  async list(@OwnerId() ownerId: string) {
    return this.repository.getAccounts(ownerId);
  }

  @Post()
  async create(@OwnerId() ownerId: string, @Body() body: CreateAccountBody) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const type = body.type;
    const currency = typeof body.currency === "string" ? body.currency.trim().toUpperCase() : "KES";

    if (!name) throw new BadRequestException("name is required");
    if (!ACCOUNT_TYPES.has(type)) throw new BadRequestException("type is invalid");
    if (!/^[A-Z]{3}$/.test(currency)) throw new BadRequestException("currency must be a 3-letter ISO-style code");

    const account: Account = {
      accountId: randomUUID(),
      ownerId,
      name,
      type,
      currency: currency as CurrencyCode,
      status: "active",
    };

    await this.repository.saveAccount(account);
    return account;
  }
}
