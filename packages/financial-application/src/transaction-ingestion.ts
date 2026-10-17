import type { Transaction } from "@afrifinos/financial-domain";
import type { RawTransaction } from "@afrifinos/financial-engine";
import { buildLedgerEntries, processTransaction } from "@afrifinos/financial-engine";
import type { TransactionWriteRepository } from "@afrifinos/financial-persistence";

export class TransactionInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransactionInputError";
  }
}

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
  readonly persistence: "inserted" | "duplicate";
}

function validateCommand(command: IngestTransactionCommand): void {
  if (!command.ownerId.trim()) throw new TransactionInputError("ownerId cannot be empty");
  if (!command.primaryAccountId.trim()) throw new TransactionInputError("primaryAccountId cannot be empty");
  if (!command.counterAccountId.trim()) throw new TransactionInputError("counterAccountId cannot be empty");
  if (!command.transactionId.trim()) throw new TransactionInputError("transactionId cannot be empty");
  if (command.primaryAccountId === command.counterAccountId) {
    throw new TransactionInputError("Primary and counter accounts must be different");
  }
  if (command.providerId !== undefined && !command.providerId.trim()) {
    throw new TransactionInputError("providerId cannot be empty when provided");
  }
  if (command.input.externalId && !command.providerId) {
    throw new TransactionInputError("providerId is required when externalId is provided");
  }
}

export async function ingestTransaction(
  repository: TransactionWriteRepository,
  command: IngestTransactionCommand,
): Promise<IngestTransactionResult> {
  validateCommand(command);
  try {
    await repository.assertAccountsOwnedBy(command.ownerId, [
      command.primaryAccountId,
      command.counterAccountId,
    ]);
  } catch (error) {
    if (error instanceof Error && error.message === "One or more accounts do not belong to the authenticated owner") {
      throw new TransactionInputError(error.message);
    }
    throw error;
  }
  try {
    await repository.assertAccountsCurrency(command.ownerId, [
      command.primaryAccountId,
      command.counterAccountId,
    ], command.input.currency);
  } catch (error) {
    if (error instanceof Error && error.message === "Transaction currency must match both account currencies") {
      throw new TransactionInputError(error.message);
    }
    throw error;
  }

  if (command.providerId && command.input.externalId) {
    const existing = await repository.getTransactionByProviderExternalId(
      command.ownerId,
      command.providerId,
      command.input.externalId,
    );
    if (existing) return duplicateResult(existing);
  }

  const enriched = processTransaction(command.input, {
    sourceKind: command.sourceKind,
    ...(command.providerId ? { providerId: command.providerId } : {}),
    ...(command.importedAt ? { importedAt: command.importedAt } : {}),
    ...(command.sourceHash ? { sourceHash: command.sourceHash } : {}),
  });

  const transaction: Transaction = {
    transactionId: command.transactionId,
    ownerId: command.ownerId,
    type: enriched.type,
    status: "posted",
    occurredAt: enriched.occurredAt,
    description: enriched.description,
    ...(enriched.counterparty ? { counterparty: enriched.counterparty } : {}),
    ...(enriched.categoryId ? { categoryId: enriched.categoryId } : {}),
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

  const persistence = await repository.saveTransactionWithLedger(transaction, entries);
  if (persistence === "duplicate") {
    if (!command.providerId || !command.input.externalId) {
      throw new Error("Transaction write conflicted with an existing record but no canonical external identity is available");
    }

    const canonical = await repository.getTransactionByProviderExternalId(
      command.ownerId,
      command.providerId,
      command.input.externalId,
    );
    if (!canonical) throw new Error("Transaction write reported a duplicate but the canonical transaction could not be loaded");
    return duplicateResult(canonical);
  }

  return {
    transaction,
    ledgerEntryCount: entries.length,
    categoryConfidence: enriched.categoryConfidence,
    categoryMatchedKeywords: enriched.categoryMatchedKeywords,
    persistence: "inserted",
  };
}

function duplicateResult(transaction: Transaction): IngestTransactionResult {
  return {
    transaction,
    ledgerEntryCount: 0,
    categoryConfidence: 1,
    categoryMatchedKeywords: [],
    persistence: "duplicate",
  };
}
