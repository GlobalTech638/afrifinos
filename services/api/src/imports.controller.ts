import { BadRequestException, Body, Controller, Inject, Post } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { parseTransactionCsv } from "@afrifinos/financial-ingestion";
import { ingestTransactionBatch } from "@afrifinos/financial-application";
import type { FinancialRepository, TransactionWriteRepository } from "@afrifinos/financial-persistence";
import { FINANCIAL_REPOSITORY } from "./app.module.js";
import { OwnerId } from "./auth-context.js";

interface CsvImportBody {
  readonly csv: string;
  readonly primaryAccountId: string;
  readonly counterAccountId: string;
  readonly providerId?: string;
}

@Controller("imports")
export class ImportsController {
  constructor(
    @Inject(FINANCIAL_REPOSITORY) private readonly repository: FinancialRepository & TransactionWriteRepository,
  ) {}

  @Post("csv")
  async importCsv(@OwnerId() ownerId: string, @Body() body: CsvImportBody) {
    if (!body.csv?.trim()) throw new BadRequestException("csv is required");
    if (!body.primaryAccountId?.trim() || !body.counterAccountId?.trim()) {
      throw new BadRequestException("primaryAccountId and counterAccountId are required");
    }
    if (body.providerId !== undefined && !body.providerId.trim()) {
      throw new BadRequestException("providerId cannot be empty");
    }

    const parsed = parseTransactionCsv(body.csv);
    const result = ingestTransactionBatch(this.repository, {
      ownerId,
      primaryAccountId: body.primaryAccountId,
      counterAccountId: body.counterAccountId,
      inputs: parsed.rows,
      sourceKind: "csv",
      providerId: body.providerId,
      transactionIdFor: () => randomUUID(),
    });

    try {
      const batch = await result;
      const persistenceErrors = batch.failures.map((failure) => ({
        row: failure.index + 2,
        message: failure.message,
      }));

      return {
        importedCount: batch.persisted.filter((item) => item.persistence === "inserted").length,
        duplicateCount:
          batch.persisted.filter((item) => item.persistence === "duplicate").length +
          batch.duplicates.length,
        rejectedCount: parsed.errors.length + persistenceErrors.length,
        parseErrors: parsed.errors,
        persistenceErrors,
        transactionIds: batch.persisted.map((item) => item.transaction.transactionId),
      };
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "CSV import failed");
    }
  }
}
