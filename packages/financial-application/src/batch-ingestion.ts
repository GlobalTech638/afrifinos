import type { RawTransaction } from "@afrifinos/financial-engine";
import { deduplicateTransactions } from "@afrifinos/financial-ingestion";
import type { TransactionWriteRepository } from "@afrifinos/financial-persistence";
import { ingestTransaction, type IngestTransactionResult } from "./transaction-ingestion.js";

export interface BatchIngestTransactionCommand {
  readonly ownerId: string;
  readonly primaryAccountId: string;
  readonly counterAccountId: string;
  readonly inputs: readonly RawTransaction[];
  readonly sourceKind: "manual" | "csv" | "provider_api" | "provider_file" | "system";
  readonly providerId?: string;
  readonly importedAt?: string;
  readonly sourceHash?: string;
  readonly transactionIdFor: (input: RawTransaction, index: number) => string;
}

export interface BatchIngestTransactionResult {
  readonly persisted: readonly IngestTransactionResult[];
  readonly duplicates: readonly RawTransaction[];
}

export async function ingestTransactionBatch(
  repository: TransactionWriteRepository,
  command: BatchIngestTransactionCommand,
): Promise<BatchIngestTransactionResult> {
  const deduplicated = deduplicateTransactions(command.inputs, command.providerId);
  const persisted: IngestTransactionResult[] = [];

  for (let index = 0; index < deduplicated.unique.length; index += 1) {
    const input = deduplicated.unique[index];
    if (!input) continue;

    persisted.push(await ingestTransaction(repository, {
      ownerId: command.ownerId,
      primaryAccountId: command.primaryAccountId,
      counterAccountId: command.counterAccountId,
      transactionId: command.transactionIdFor(input, index),
      sourceKind: command.sourceKind,
      providerId: command.providerId,
      importedAt: command.importedAt,
      sourceHash: command.sourceHash,
      input,
    }));
  }

  return {
    persisted,
    duplicates: deduplicated.duplicates,
  };
}
