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
    const failures: Array<{ row: number; message: string }> = [];
    const validRows = parsed.rows;

    try {
      const result = await ingestTransactionBatch(this.repository, {
        ownerId,
        primaryAccountId: body.primaryAccountId,
        counterAccountId: body.counterAccountId,
        inputs: validRows,
        sourceKind: "csv",
        providerId: body.providerId,
        transactionIdFor: () => randomUUID(),
      });

      return {
        importedCount: result.persisted.filter((item) => item.persistence === "inserted").length,
        duplicateCount: result.persisted.filter((item) => item.persistence === "duplicate").length + result.duplicates.length,
        rejectedCount: parsed.errors.length + failures.length,
        parseErrors: parsed.errors,
        persistenceErrors: failures,
        transactionIds: result.persisted.map((item) => item.transaction.transactionId),
      };
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "CSV import failed");
    }
  }
}
