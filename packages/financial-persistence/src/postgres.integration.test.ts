import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
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
    const directory = join(process.cwd(), "migrations");
    const files = (await readdir(directory))
      .filter((file) => /^\\d+_.*\\.sql$/.test(file))
      .sort();

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
    } finally {
      client.release();
    }
  }, 30_000);

  afterAll(async () => {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.end();
  });

  async function seed(ownerId: string, suffix: string) {
    await pool.query("INSERT INTO users (id) VALUES ($1)", [ownerId]);
    await pool.query(
      "INSERT INTO accounts (id, owner_id, name, type, currency) VALUES ($1, $2, $3, 'cash', 'KES'), ($4, $2, $5, 'other', 'KES')",
      [`cash-${suffix}`, ownerId, "Cash", `expense-${suffix}`, "Expense"],
    );
    await pool.query(
      "INSERT INTO transactions (id, owner_id, type, occurred_at, amount_minor, currency, source_kind) VALUES ($1, $2, 'expense', now(), 100, 'KES', 'manual')",
      [`txn-${suffix}`, ownerId],
    );
    return { transactionId: `txn-${suffix}`, debitAccountId: `cash-${suffix}`, creditAccountId: `expense-${suffix}` };
  }

  it("allows a complete balanced posting to commit", async () => {
    const ids = await seed("owner-balanced", "balanced");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "INSERT INTO ledger_entries (id, transaction_id, account_id, currency, amount_minor, direction, posted_at) VALUES ($1, $2, $3, 'KES', 100, 'debit', now()), ($4, $2, $5, 'KES', 100, 'credit', now())",
        [`debit-${ids.transactionId}`, ids.transactionId, ids.debitAccountId, `credit-${ids.transactionId}`, ids.creditAccountId],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    const result = await pool.query(`SELECT COUNT(*)::int AS count FROM "${schema}".ledger_entries WHERE transaction_id = $1`, [ids.transactionId]);
    expect(result.rows[0]?.count).toBe(2);
  });

  it("rejects a ledger entry that crosses owner boundaries", async () => {
    const transaction = await seed("owner-txn", "cross-owner-txn");
    await pool.query("INSERT INTO users (id) VALUES ($1)", ["owner-account"]);
    await pool.query(
      "INSERT INTO accounts (id, owner_id, name, type, currency) VALUES ($1, $2, 'Foreign account', 'cash', 'KES')",
      ["foreign-account", "owner-account"],
    );

    await expect(pool.query(
      "INSERT INTO ledger_entries (id, transaction_id, account_id, currency, amount_minor, direction, posted_at) VALUES ('cross-owner-entry', $1, 'foreign-account', 'KES', 100, 'debit', now())",
      [transaction.transactionId],
    )).rejects.toThrow(/Ledger account must belong to the transaction owner/);
  });

  it("rejects an incomplete posting at transaction commit", async () => {
    const ids = await seed("owner-incomplete", "incomplete");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "INSERT INTO ledger_entries (id, transaction_id, account_id, currency, amount_minor, direction, posted_at) VALUES ($1, $2, $3, 'KES', 100, 'debit', now())",
        [`debit-${ids.transactionId}`, ids.transactionId, ids.debitAccountId],
      );
      await expect(client.query("COMMIT"))
        .rejects.toThrow(/at least two distinct accounts/);
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("rejects a transaction amount update that would unbalance existing postings", async () => {
    const ids = await seed("owner-amount-update", "amount-update");
    await pool.query(
      "INSERT INTO ledger_entries (id, transaction_id, account_id, currency, amount_minor, direction, posted_at) VALUES ($1, $2, $3, 'KES', 100, 'debit', now()), ($4, $2, $5, 'KES', 100, 'credit', now())",
      [`debit-${ids.transactionId}`, ids.transactionId, ids.debitAccountId, `credit-${ids.transactionId}`, ids.creditAccountId],
    );
    const client = await pool.connect();
    try {
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
