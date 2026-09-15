import { BadRequestException, Body, Controller, Get, Inject, Post, Query } from "@nestjs/common";
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

const TRANSACTION_TYPES = new Set<NonNullable<RawTransaction["type"]>>([
  "income", "expense", "transfer", "fee", "refund", "reversal", "adjustment",
]);
const SOURCE_KINDS = new Set<NonNullable<CreateTransactionBody["sourceKind"]>>([
  "manual", "csv", "provider_api", "provider_file", "system",
]);

function parseAmountMinor(value: string | number): bigint {
  try {
    if (typeof value === "number" && !Number.isSafeInteger(value)) throw new Error("unsafe number");
    const parsed = BigInt(value);
    if (parsed === 0n) throw new Error("zero amount");
    return parsed;
  } catch {
    throw new BadRequestException("amountMinor must be a non-zero integer amount in minor currency units");
  }
}

function validateOccurredAt(value: string): string {
  if (typeof value !== "string" || !value.trim() || Number.isNaN(Date.parse(value))) {
    throw new BadRequestException("occurredAt must be a valid ISO-compatible date");
  }
  return new Date(value).toISOString();
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
    if (!body.primaryAccountId?.trim() || !body.counterAccountId?.trim()) {
      throw new BadRequestException("primaryAccountId and counterAccountId are required");
    }
    if (!body.description?.trim()) throw new BadRequestException("description is required");
    if (!/^[A-Z]{3}$/i.test(body.currency ?? "")) throw new BadRequestException("currency must be a 3-letter ISO-style code");
    if (body.type !== undefined && !TRANSACTION_TYPES.has(body.type)) throw new BadRequestException("type is invalid");
    if (body.sourceKind !== undefined && !SOURCE_KINDS.has(body.sourceKind)) throw new BadRequestException("sourceKind is invalid");
    if (body.providerId !== undefined && !body.providerId.trim()) throw new BadRequestException("providerId cannot be empty");
    if (body.externalId !== undefined && !body.externalId.trim()) throw new BadRequestException("externalId cannot be empty");
    if (body.externalId && !body.providerId) throw new BadRequestException("providerId is required when externalId is provided");

    const input: RawTransaction = {
      occurredAt: validateOccurredAt(body.occurredAt),
      description: body.description.trim(),
      amountMinor: parseAmountMinor(body.amountMinor),
      currency: body.currency.toUpperCase() as RawTransaction["currency"],
      type: body.type,
      counterparty: body.counterparty?.trim() || undefined,
      externalId: body.externalId?.trim() || undefined,
    };

    try {
      const result = await ingestTransaction(this.repository, {
        ownerId,
        primaryAccountId: body.primaryAccountId.trim(),
        counterAccountId: body.counterAccountId.trim(),
        input,
        sourceKind: body.sourceKind ?? "manual",
        providerId: body.providerId?.trim(),
        transactionId: randomUUID(),
      });

      return {
        ...result,
        transaction: {
          ...result.transaction,
          total: { ...result.transaction.total, amountMinor: result.transaction.total.amountMinor.toString() },
        },
      };
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Unable to create transaction");
    }
  }
}
