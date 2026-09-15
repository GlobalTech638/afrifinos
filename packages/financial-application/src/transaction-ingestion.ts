import type { Transaction } from "@afrifinos/financial-domain";
import type { RawTransaction } from "@afrifinos/financial-engine";
import { buildLedgerEntries } from "@afrifinos/financial-engine";
import { processTransaction } from "@afrifinos/financial-engine";
import type { TransactionWriteRepository } from "@afrifinos/financial-persistence";

export interface IngestTransactionCommand {
  readonly ownerId: string;
  readonly primaryAccountId: string;
  readonly counterAccountId: string;
  readonly input: RawTransaction;
  readonly sourceKind: "manual" | "csv" | "provider_api" | "provider_file" | "system";
  readonly providerId?: string;
  readonly importedAt?: string;
  readonly sourceHash?: string;
  readonly transactionId: string;
}

export interface IngestTransactionResult {
  readonly transaction: Transaction;
  readonly ledgerEntryCount: number;
  readonly categoryConfidence: number;
  readonly categoryMatchedKeywords: readonly string[];
}

function validateCommand(command: IngestTransactionCommand): void {
  if (!command.ownerId.trim()) throw new Error("ownerId cannot be empty");
  if (!command.primaryAccountId.trim()) throw new Error("primaryAccountId cannot be empty");
  if (!command.counterAccountId.trim()) throw new Error("counterAccountId cannot be empty");
  if (!command.transactionId.trim()) throw new Error("transactionId cannot be empty");
  if (command.primaryAccountId === command.counterAccountId) {
    throw new Error("Primary and counter accounts must be different");
  }
}

export async function ingestTransaction(
  repository: TransactionWriteRepository,
  command: IngestTransactionCommand,
): Promise<IngestTransactionResult> {
  validateCommand(command);

  const enriched = processTransaction(command.input, {
    sourceKind: command.sourceKind,
    providerId: command.providerId,
    importedAt: command.importedAt,
    sourceHash: command.sourceHash,
  });

  const transaction: Transaction = {
    transactionId: command.transactionId,
    ownerId: command.ownerId,
    type: enriched.type,
    status: "posted",
    occurredAt: enriched.occurredAt,
    description: enriched.description,
    counterparty: enriched.counterparty,
    categoryId: enriched.categoryId,
    total: {
      amountMinor: enriched.amountMinor < 0n ? -enriched.amountMinor : enriched.amountMinor,
      currency: enriched.currency,
    },
    provenance: enriched.provenance,
  };

  const entries = buildLedgerEntries({
    transactionId: transaction.transactionId,
    postedAt: transaction.occurredAt,
    currency: transaction.total.currency,
    amountMinor: transaction.total.amountMinor,
    type: transaction.type,
    primaryAccountId: command.primaryAccountId,
    counterAccountId: command.counterAccountId,
  });

  await repository.saveTransactionWithLedger(transaction, entries);

  return {
    transaction,
    ledgerEntryCount: entries.length,
    categoryConfidence: enriched.categoryConfidence,
    categoryMatchedKeywords: enriched.categoryMatchedKeywords,
  };
}
