import { BadRequestException, Body, Controller, Headers, Inject, Post } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { parseTransactionCsv } from "@afrifinos/financial-ingestion";
import { ingestTransaction } from "@afrifinos/financial-application";
import type { FinancialRepository, TransactionWriteRepository } from "@afrifinos/financial-persistence";
import { FINANCIAL_REPOSITORY } from "./app.module.js";

interface CsvImportBody {
  csv: string;
  primaryAccountId: string;
  counterAccountId: string;
  providerId?: string;
}

@Controller("imports")
export class ImportsController {
  constructor(
    @Inject(FINANCIAL_REPOSITORY) private readonly repository: FinancialRepository & TransactionWriteRepository,
  ) {}

  @Post("csv")
  async importCsv(
    @Headers("x-owner-id") ownerId: string | undefined,
    @Body() body: CsvImportBody,
  ) {
    if (!ownerId?.trim()) {
      throw new BadRequestException("x-owner-id header is required until authentication is implemented");
    }
    if (!body.csv?.trim()) throw new BadRequestException("csv is required");
    if (!body.primaryAccountId?.trim() || !body.counterAccountId?.trim()) {
      throw new BadRequestException("primaryAccountId and counterAccountId are required");
    }

    const parsed = parseTransactionCsv(body.csv);
    const persisted: string[] = [];
    const failures: Array<{ row: number; message: string }> = [];

    for (const [index, row] of parsed.rows.entries()) {
      try {
        const result = await ingestTransaction(this.repository, {
          ownerId: ownerId.trim(),
          primaryAccountId: body.primaryAccountId,
          counterAccountId: body.counterAccountId,
          input: row,
          sourceKind: "csv",
          providerId: body.providerId,
          transactionId: randomUUID(),
        });
        persisted.push(result.transaction.transactionId);
      } catch (error) {
        failures.push({
          row: index + 2,
          message: error instanceof Error ? error.message : "Failed to persist row",
        });
      }
    }

    return {
      importedCount: persisted.length,
      rejectedCount: parsed.errors.length + failures.length,
      parseErrors: parsed.errors,
      persistenceErrors: failures,
      transactionIds: persisted,
    };
  }
}
