import type { Account } from "@afrifinos/financial-domain";

export interface AccountOwnershipRepository {
  getAccountForOwner(ownerId: string, accountId: string): Promise<Account | null>;
}
