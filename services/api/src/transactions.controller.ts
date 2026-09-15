import { Body, Controller, Get, Inject, Post, Query } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { RawTransaction } from "@afrifinos/financial-engine";
import type { FinancialRepository, TransactionWriteRepository } from "@afrifinos/financial-persistence";
import { FINANCIAL_REPOSITORY } from "./app.module.js";
import { OwnerId } from "./auth-context.js";
import { ingestTransaction } from "@afrifinos/financial-application";

interface CreateTransactionBody {
  readonly primaryAccountId: string;
  readonly counterAccountId: string;
  readonly occurredAt: string;
  readonly description: string;
  readonly amountMinor: string | number;
  readonly currency: string;
  readonly type?: RawTransaction["type"];
  readonly counterparty?: string;
  readonly externalId?: string;
  readonly providerId?: string;
  readonly sourceKind?: "manual" | "csv" | "provider_api" | "provider_file" | "system";
}

@Controller("transactions")
export class TransactionsController {
  constructor(
    @Inject(FINANCIAL_REPOSITORY) private readonly repository: FinancialRepository & TransactionWriteRepository,
  ) {}

  @Get()
  async list(@OwnerId() ownerId: string, @Query("from") from?: string, @Query("to") to?: string) {
    return this.repository.getTransactions(ownerId, from, to);
  }

  @Post()
  async create(@OwnerId() ownerId: string, @Body() body: CreateTransactionBody) {
    const input: RawTransaction = {
      occurredAt: body.occurredAt,
      description: body.description,
      amountMinor: BigInt(body.amountMinor),
      currency: body.currency.toUpperCase() as RawTransaction["currency"],
      type: body.type,
      counterparty: body.counterparty,
      externalId: body.externalId,
    };

    const result = await ingestTransaction(this.repository, {
      ownerId,
      primaryAccountId: body.primaryAccountId,
      counterAccountId: body.counterAccountId,
      input,
      sourceKind: body.sourceKind ?? "manual",
      providerId: body.providerId,
      transactionId: randomUUID(),
    });

    return {
      ...result,
      transaction: {
        ...result.transaction,
        total: {
          ...result.transaction.total,
          amountMinor: result.transaction.total.amountMinor.toString(),
        },
      },
    };
  }
}
