import { Body, Controller, Get, Headers, BadRequestException, Inject, Post, Query } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { RawTransaction } from "@afrifinos/financial-engine";
import type { FinancialRepository, TransactionWriteRepository } from "@afrifinos/financial-persistence";
import { FINANCIAL_REPOSITORY } from "./app.module.js";
import { ingestTransaction } from "@afrifinos/financial-application";

interface CreateTransactionBody {
  primaryAccountId: string;
  counterAccountId: string;
  occurredAt: string;
  description: string;
  amountMinor: string | number;
  currency: string;
  type?: RawTransaction["type"];
  counterparty?: string;
  externalId?: string;
  providerId?: string;
  sourceKind?: "manual" | "csv" | "provider_api" | "provider_file" | "system";
}

@Controller("transactions")
export class TransactionsController {
  constructor(
    @Inject(FINANCIAL_REPOSITORY) private readonly repository: FinancialRepository & TransactionWriteRepository,
  ) {}

  @Get()
  async list(
    @Headers("x-owner-id") ownerId: string | undefined,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    if (!ownerId?.trim()) {
      throw new BadRequestException("x-owner-id header is required until authentication is implemented");
    }
    return this.repository.getTransactions(ownerId.trim(), from, to);
  }

  @Post()
  async create(
    @Headers("x-owner-id") ownerId: string | undefined,
    @Body() body: CreateTransactionBody,
  ) {
    if (!ownerId?.trim()) {
      throw new BadRequestException("x-owner-id header is required until authentication is implemented");
    }

    const input: RawTransaction = {
      occurredAt: body.occurredAt,
      description: body.description,
      amountMinor: BigInt(body.amountMinor),
      currency: body.currency.toUpperCase() as RawTransaction["currency"],
      type: body.type,
      counterparty: body.counterparty,
      externalId: body.externalId,
    };

    return ingestTransaction(this.repository, {
      ownerId: ownerId.trim(),
      primaryAccountId: body.primaryAccountId,
      counterAccountId: body.counterAccountId,
      input,
      sourceKind: body.sourceKind ?? "manual",
      providerId: body.providerId,
      transactionId: randomUUID(),
    });
  }
}
