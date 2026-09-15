import type { Transaction } from "@afrifinos/financial-domain";
import type { RawTransaction } from "@afrifinos/financial-engine";
import { buildLedgerEntries, processTransaction } from "@afrifinos/financial-engine";
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
  readonly persistence: "inserted" | "duplicate";
}

function validateCommand(command: IngestTransactionCommand): void {
  if (!command.ownerId.trim()) throw new Error("ownerId cannot be empty");
  if (!command.primaryAccountId.trim()) throw new Error("primaryAccountId cannot be empty");
  if (!command.counterAccountId.trim()) throw new Error("counterAccountId cannot be empty");
  if (!command.transactionId.trim()) throw new Error("transactionId cannot be empty");
  if (command.primaryAccountId === command.counterAccountId) {
    throw new Error("Primary and counter accounts must be different");
  }
  if (command.providerId && !command.providerId.trim()) {
    throw new Error("providerId cannot be empty when provided");
  }
  if (command.input.externalId && !command.providerId) {
    throw new Error("providerId is required when externalId is provided");
  }
}

export async function ingestTransaction(
  repository: TransactionWriteRepository,
  command: IngestTransactionCommand,
): Promise<IngestTransactionResult> {
  validateCommand(command);
  await repository.assertAccountsOwnedBy(command.ownerId, [
    command.primaryAccountId,
    command.counterAccountId,
  ]);

  if (command.providerId && command.input.externalId) {
    const existing = await repository.getTransactionByProviderExternalId(
      command.ownerId,
      command.providerId,
      command.input.externalId,
    );
    if (existing) {
      return {
        transaction: existing,
        ledgerEntryCount: 0,
        categoryConfidence: 1,
        categoryMatchedKeywords: [],
        persistence: "duplicate",
      };
    }
  }

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

  const persistence = await repository.saveTransactionWithLedger(transaction, entries);

  return {
    transaction,
    ledgerEntryCount: persistence === "duplicate" ? 0 : entries.length,
    categoryConfidence: enriched.categoryConfidence,
    categoryMatchedKeywords: enriched.categoryMatchedKeywords,
    persistence,
  };
}
