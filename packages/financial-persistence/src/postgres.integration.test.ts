import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
const integration = describe.skipIf(!databaseUrl)("PostgreSQL ledger integrity migrations", () => {
  const schema = `afrifinos_it_${process.pid}`;
  const admin = new Pool({ connectionString: databaseUrl, max: 1 });
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    options: `-c search_path=${schema},public`,
  });

  beforeAll(async () => {
    await admin.query(`CREATE SCHEMA "${schema}"`);
    const directory = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");
    const files = (await readdir(directory))
      .filter((file) => /^\d+_.*\.sql$/.test(file))
      .sort();
    if (files.length === 0) throw new Error("No SQL migrations found in " + directory);

    const client = await pool.connect();
    try {
      // Set the schema explicitly on the migration connection. Keep the pool
      // single-connection so subsequent test queries use the same isolated path.
      await client.query(`SET search_path TO "${schema}", public`);
      for (const file of files) {
        await client.query("BEGIN");
        try {
          await client.query(await readFile(join(directory, file), "utf8"));
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          throw new Error(`Migration ${file} failed: ${String(error)}`);
        }
      }
      const schemaCheck = await client.query(
        "SELECT to_regclass($1) AS users_table",
        [schema + ".users"],
      );
      if (!schemaCheck.rows[0]?.users_table) {
        throw new Error("Migrations completed without creating " + schema + ".users");
      }
    } finally {
      client.release();
    }
  }, 30_000);

  afterAll(async () => {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.end();
  });

  async function query(text: string, values: readonly unknown[] = []) {
    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO "${schema}", public`);
      return await client.query(text, [...values]);
    } finally {
      client.release();
    }
  }

  async function seed(ownerId: string, suffix: string) {
    await query("INSERT INTO users (id) VALUES ($1)", [ownerId]);
    await query(
      "INSERT INTO accounts (id, owner_id, name, type, currency) VALUES ($1, $2, $3, 'cash', 'KES'), ($4, $2, $5, 'other', 'KES')",
      [`cash-${suffix}`, ownerId, "Cash", `expense-${suffix}`, "Expense"],
    );
    await query(
      "INSERT INTO transactions (id, owner_id, type, occurred_at, amount_minor, currency, source_kind) VALUES ($1, $2, 'expense', now(), 100, 'KES', 'manual')",
      [`txn-${suffix}`, ownerId],
    );
    return { transactionId: `txn-${suffix}`, debitAccountId: `cash-${suffix}`, creditAccountId: `expense-${suffix}` };
  }

  it("enforces provider transaction idempotency within an owner namespace", async () => {
    await query("INSERT INTO users (id) VALUES ($1)", ["owner-provider-idempotency"]);
    await query("INSERT INTO providers (id, name) VALUES ($1, $2)", [
      "00000000-0000-4000-8000-00000000000a",
      "Bank A",
    ]);
    const insert = `INSERT INTO transactions
      (id, owner_id, type, occurred_at, amount_minor, currency, source_kind, provider_id, external_id)
      VALUES ($1, $2, 'expense', now(), 100, 'KES', 'provider_file', '00000000-0000-4000-8000-00000000000a', 'statement-row-1')
      ON CONFLICT (owner_id, provider_id, external_id)
      WHERE provider_id IS NOT NULL AND external_id IS NOT NULL
      DO NOTHING
      RETURNING id`;

    const first = await query(insert, ["provider-txn-first", "owner-provider-idempotency"]);
    const retry = await query(insert, ["provider-txn-retry", "owner-provider-idempotency"]);
    expect(first.rows).toHaveLength(1);
    expect(retry.rows).toHaveLength(0);

    const stored = await query(
      "SELECT id FROM transactions WHERE owner_id = $1 AND provider_id = $2 AND external_id = $3",
      ["owner-provider-idempotency", "00000000-0000-4000-8000-00000000000a", "statement-row-1"],
    );
    expect(stored.rows).toEqual([{ id: "provider-txn-first" }]);
  });

  it("scopes provider idempotency to owner and provider", async () => {
    await query("INSERT INTO users (id) VALUES ($1), ($2)", [
      "owner-provider-scope-a",
      "owner-provider-scope-b",
    ]);
    await query("INSERT INTO providers (id, name) VALUES ($1, $2), ($3, $4)", [
      "00000000-0000-4000-8000-00000000000a",
      "Scope Bank A",
      "00000000-0000-4000-8000-00000000000b",
      "Scope Bank B",
    ]);
    const insert = `INSERT INTO transactions
      (id, owner_id, type, occurred_at, amount_minor, currency, source_kind, provider_id, external_id)
      VALUES ($1, $2, 'expense', now(), 100, 'KES', 'provider_file', $3, 'shared-external-id')
      ON CONFLICT (owner_id, provider_id, external_id)
      WHERE provider_id IS NOT NULL AND external_id IS NOT NULL
      DO NOTHING
      RETURNING id`;

    const firstOwner = await query(insert, [
      "provider-scope-a",
      "owner-provider-scope-a",
      "00000000-0000-4000-8000-00000000000a",
    ]);
    const secondOwner = await query(insert, [
      "provider-scope-b",
      "owner-provider-scope-b",
      "bank-a",
    ]);
    const secondProvider = await query(insert, [
      "provider-scope-c",
      "owner-provider-scope-a",
      "00000000-0000-4000-8000-00000000000b",
    ]);

    expect(firstOwner.rows).toHaveLength(1);
    expect(secondOwner.rows).toHaveLength(1);
    expect(secondProvider.rows).toHaveLength(1);
  });

  it("rolls back the transaction row when its ledger fails at commit", async () => {
    const ids = await seed("owner-atomic-rollback", "atomic-rollback");
    const transactionId = randomUUID();
    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO "${schema}", public`);
      await client.query("BEGIN");
      await client.query(
        "INSERT INTO transactions (id, owner_id, type, occurred_at, amount_minor, currency, source_kind) VALUES ($1, $2, 'expense', now(), 100, 'KES', 'manual')",
        [transactionId, "owner-atomic-rollback"],
      );
      await client.query(
        "INSERT INTO ledger_entries (id, transaction_id, account_id, currency, amount_minor, direction, posted_at) VALUES ($1, $2, $3, 'KES', 100, 'debit', now())",
        [randomUUID(), transactionId, ids.debitAccountId],
      );
      await expect(client.query("COMMIT")).rejects.toMatchObject({ code: "23514" });
      await client.query("ROLLBACK").catch(() => undefined);
    } finally {
      client.release();
    }

    const result = await query("SELECT id FROM transactions WHERE id = $1", [transactionId]);
    expect(result.rows).toHaveLength(0);
    const entries = await query(
      "SELECT id FROM ledger_entries WHERE transaction_id = $1",
      [transactionId],
    );
    expect(entries.rows).toHaveLength(0);
  });

  it("allows a complete balanced posting to commit", async () => {
    const ids = await seed("owner-balanced", "balanced");
    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO "${schema}", public`);
      await client.query("BEGIN");
      await client.query(
        "INSERT INTO ledger_entries (id, transaction_id, account_id, currency, amount_minor, direction, posted_at) VALUES ($1, $2, $3, 'KES', 100, 'debit', now()), ($4, $2, $5, 'KES', 100, 'credit', now())",
        [randomUUID(), ids.transactionId, ids.debitAccountId, randomUUID(), ids.creditAccountId],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    const result = await query("SELECT COUNT(*)::int AS count FROM ledger_entries WHERE transaction_id = $1", [ids.transactionId]);
    expect(result.rows[0]?.count).toBe(2);
  });

  it("rejects a ledger entry that crosses owner boundaries", async () => {
    const transaction = await seed("owner-txn", "cross-owner-txn");
    await query("INSERT INTO users (id) VALUES ($1)", ["owner-account"]);
    await query(
      "INSERT INTO accounts (id, owner_id, name, type, currency) VALUES ($1, $2, 'Foreign account', 'cash', 'KES')",
      ["foreign-account", "owner-account"],
    );

    await expect(query(
      "INSERT INTO ledger_entries (id, transaction_id, account_id, currency, amount_minor, direction, posted_at) VALUES ($2, $1, 'foreign-account', 'KES', 100, 'debit', now())",
      [transaction.transactionId, randomUUID()],
    )).rejects.toThrow(/Ledger account must belong to the transaction owner/);
  });

  it("rejects an incomplete posting at transaction commit", async () => {
    const ids = await seed("owner-incomplete", "incomplete");
    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO "${schema}", public`);
      await client.query("BEGIN");
      await client.query(
        "INSERT INTO ledger_entries (id, transaction_id, account_id, currency, amount_minor, direction, posted_at) VALUES ($1, $2, $3, 'KES', 100, 'debit', now())",
        [randomUUID(), ids.transactionId, ids.debitAccountId],
      );
      await expect(client.query("COMMIT"))
        .rejects.toThrow(/at least two distinct accounts/);
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("rejects a ledger entry whose currency differs from its account and transaction", async () => {
    const ids = await seed("owner-currency-mismatch", "currency-mismatch");
    await expect(query(
      "INSERT INTO ledger_entries (id, transaction_id, account_id, currency, amount_minor, direction, posted_at) VALUES ($1, $2, $3, 'USD', 100, 'debit', now())",
      [randomUUID(), ids.transactionId, ids.debitAccountId],
    )).rejects.toThrow(/Ledger entry currency must match transaction and account currencies/);
  });

  it("rejects unequal debit and credit totals at transaction commit", async () => {
    const ids = await seed("owner-unbalanced", "unbalanced");
    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO "${schema}", public`);
      await client.query("BEGIN");
      await client.query(
        "INSERT INTO ledger_entries (id, transaction_id, account_id, currency, amount_minor, direction, posted_at) VALUES ($1, $2, $3, 'KES', 100, 'debit', now()), ($4, $2, $5, 'KES', 90, 'credit', now())",
        [randomUUID(), ids.transactionId, ids.debitAccountId, randomUUID(), ids.creditAccountId],
      );
      await expect(client.query("COMMIT"))
        .rejects.toThrow(/equal positive debit and credit totals/);
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("rejects account currency changes that invalidate existing ledger entries", async () => {
    const ids = await seed("owner-account-currency-update", "account-currency-update");
    await query(
      "INSERT INTO ledger_entries (id, transaction_id, account_id, currency, amount_minor, direction, posted_at) VALUES ($1, $2, $3, 'KES', 100, 'debit', now()), ($4, $2, $5, 'KES', 100, 'credit', now())",
      [randomUUID(), ids.transactionId, ids.debitAccountId, randomUUID(), ids.creditAccountId],
    );

    await expect(query(
      "UPDATE accounts SET currency = 'USD' WHERE id = $1",
      [ids.debitAccountId],
    )).rejects.toThrow(/Account owner and currency must remain compatible/);
  });

  it("rejects account owner changes that invalidate existing ledger entries", async () => {
    const ids = await seed("owner-account-owner-update", "account-owner-update");
    await query("INSERT INTO users (id) VALUES ($1)", ["replacement-owner"]);
    await query(
      "INSERT INTO ledger_entries (id, transaction_id, account_id, currency, amount_minor, direction, posted_at) VALUES ($1, $2, $3, 'KES', 100, 'debit', now()), ($4, $2, $5, 'KES', 100, 'credit', now())",
      [randomUUID(), ids.transactionId, ids.debitAccountId, randomUUID(), ids.creditAccountId],
    );

    await expect(query(
      "UPDATE accounts SET owner_id = 'replacement-owner' WHERE id = $1",
      [ids.debitAccountId],
    )).rejects.toThrow(/Account owner and currency must remain compatible/);
  });

  it("rejects transaction owner changes that invalidate existing ledger entries", async () => {
    const ids = await seed("owner-transaction-owner-update", "transaction-owner-update");
    await query("INSERT INTO users (id) VALUES ($1)", ["replacement-transaction-owner"]);
    await query(
      "INSERT INTO ledger_entries (id, transaction_id, account_id, currency, amount_minor, direction, posted_at) VALUES ($1, $2, $3, 'KES', 100, 'debit', now()), ($4, $2, $5, 'KES', 100, 'credit', now())",
      [randomUUID(), ids.transactionId, ids.debitAccountId, randomUUID(), ids.creditAccountId],
    );

    await expect(query(
      "UPDATE transactions SET owner_id = 'replacement-transaction-owner' WHERE id = $1",
      [ids.transactionId],
    )).rejects.toThrow(/Ledger accounts must match transaction owner and currency/);
  });

  it("allows replacing a ledger entry atomically when the final posting remains balanced", async () => {
    const ids = await seed("owner-ledger-replace", "ledger-replace");
    const originalDebitId = randomUUID();
    await query(
      "INSERT INTO ledger_entries (id, transaction_id, account_id, currency, amount_minor, direction, posted_at) VALUES ($1, $2, $3, 'KES', 100, 'debit', now()), ($4, $2, $5, 'KES', 100, 'credit', now())",
      [originalDebitId, ids.transactionId, ids.debitAccountId, randomUUID(), ids.creditAccountId],
    );

    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO "${schema}", public`);
      await client.query("BEGIN");
      await client.query("DELETE FROM ledger_entries WHERE id = $1", [originalDebitId]);
      await client.query(
        "INSERT INTO ledger_entries (id, transaction_id, account_id, currency, amount_minor, direction, posted_at) VALUES ($1, $2, $3, 'KES', 100, 'debit', now())",
        [randomUUID(), ids.transactionId, ids.debitAccountId],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    const result = await query(
      "SELECT COUNT(*)::int AS count, SUM(CASE WHEN direction = 'debit' THEN amount_minor ELSE 0 END)::int AS debits, SUM(CASE WHEN direction = 'credit' THEN amount_minor ELSE 0 END)::int AS credits FROM ledger_entries WHERE transaction_id = $1",
      [ids.transactionId],
    );
    expect(result.rows[0]).toMatchObject({ count: 2, debits: 100, credits: 100 });
  });

  it("rejects deleting one entry from an otherwise balanced posting", async () => {
    const ids = await seed("owner-ledger-delete", "ledger-delete");
    await query(
      "INSERT INTO ledger_entries (id, transaction_id, account_id, currency, amount_minor, direction, posted_at) VALUES ($1, $2, $3, 'KES', 100, 'debit', now()), ($4, $2, $5, 'KES', 100, 'credit', now())",
      [randomUUID(), ids.transactionId, ids.debitAccountId, randomUUID(), ids.creditAccountId],
    );

    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO "${schema}", public`);
      await client.query("BEGIN");
      await client.query(
        "DELETE FROM ledger_entries WHERE transaction_id = $1 AND direction = 'debit'",
        [ids.transactionId],
      );
      await expect(client.query("COMMIT"))
        .rejects.toThrow(/at least two distinct accounts/);
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("serializes concurrent complete postings for the same transaction", async () => {
    const ids = await seed("owner-concurrent-posting", "concurrent-posting");
    await query(
      "INSERT INTO accounts (id, owner_id, name, type, currency) VALUES ('cash-concurrent-second', 'owner-concurrent-posting', 'Second cash', 'cash', 'KES'), ('expense-concurrent-second', 'owner-concurrent-posting', 'Second expense', 'other', 'KES')",
    );
    const concurrentPool = new Pool({
      connectionString: databaseUrl,
      max: 4,
      options: `-c search_path=${schema},public`,
    });

    let readyCount = 0;
    let signalBothReady!: () => void;
    let releaseAttempts!: () => void;
    const bothReady = new Promise<void>((resolve) => { signalBothReady = resolve; });
    const startAttempts = new Promise<void>((resolve) => { releaseAttempts = resolve; });

    async function postPair(debitAccountId: string, creditAccountId: string) {
      const client = await concurrentPool.connect();
      try {
        await client.query("BEGIN");
        readyCount += 1;
        if (readyCount === 2) signalBothReady();
        await startAttempts;
        await client.query(
          "INSERT INTO ledger_entries (id, transaction_id, account_id, currency, amount_minor, direction, posted_at) VALUES ($1, $2, $3, 'KES', 100, 'debit', now()), ($4, $2, $5, 'KES', 100, 'credit', now())",
          [randomUUID(), ids.transactionId, debitAccountId, randomUUID(), creditAccountId],
        );
        await client.query("COMMIT");
        return { status: "committed" as const };
      } catch (error) {
        const code = typeof error === "object" && error !== null && "code" in error
          ? String(error.code)
          : undefined;
        await client.query("ROLLBACK").catch(() => undefined);
        return { status: "rejected" as const, code };
      } finally {
        client.release();
      }
    }

    try {
      const attempts = Promise.all([
        postPair(ids.debitAccountId, ids.creditAccountId),
        postPair("cash-concurrent-second", "expense-concurrent-second"),
      ]);
      await bothReady;
      releaseAttempts();
      const outcomes = await attempts;
      expect(outcomes.filter((outcome) => outcome.status === "committed")).toHaveLength(1);
      const rejected = outcomes.filter((outcome) => outcome.status === "rejected");
      expect(rejected).toHaveLength(1);
      // The loser must fail because the deferred ledger invariant is violated,
      // not because of a deadlock, connection failure, or unrelated SQL error.
      expect(rejected[0]?.code).toBe("23514");
      const result = await concurrentPool.query(
        "SELECT COUNT(*)::int AS count FROM ledger_entries WHERE transaction_id = $1",
        [ids.transactionId],
      );
      expect(result.rows[0]?.count).toBe(2);
    } finally {
      await concurrentPool.end();
    }
  });

  it("rejects a transaction amount update that would unbalance existing postings", async () => {
    const ids = await seed("owner-amount-update", "amount-update");
    await query(
      "INSERT INTO ledger_entries (id, transaction_id, account_id, currency, amount_minor, direction, posted_at) VALUES ($1, $2, $3, 'KES', 100, 'debit', now()), ($4, $2, $5, 'KES', 100, 'credit', now())",
      [randomUUID(), ids.transactionId, ids.debitAccountId, randomUUID(), ids.creditAccountId],
    );
    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO "${schema}", public`);
      await client.query("BEGIN");
      await client.query("UPDATE transactions SET amount_minor = 200 WHERE id = $1", [ids.transactionId]);
      await expect(client.query("COMMIT")).rejects.toThrow(/Ledger total must match the transaction amount/);
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });
});

void integration;
