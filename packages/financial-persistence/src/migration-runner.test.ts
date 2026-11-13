import { describe, expect, it } from "vitest";
import type { SqlClient, SqlQueryResult } from "./postgres.js";
import { runMigrations } from "./migration-runner.js";

type Query = { text: string; values: readonly unknown[] };

function createClient(initiallyApplied: readonly string[] = []) {
  const applied = new Set(initiallyApplied);
  const queries: Query[] = [];
  let transactions = 0;
  const client: SqlClient = {
    async query<Row extends Record<string, unknown> = Record<string, unknown>>(text: string, values: readonly unknown[] = []): Promise<SqlQueryResult<Row>> {
      queries.push({ text, values });
      return { rows: [] };
    },
    async transaction<T>(work: (tx: SqlClient) => Promise<T>): Promise<T> {
      transactions += 1;
      const tx: SqlClient = {
        async query<Row extends Record<string, unknown> = Record<string, unknown>>(text: string, values: readonly unknown[] = []): Promise<SqlQueryResult<Row>> {
          queries.push({ text, values });
          if (text.includes("SELECT id FROM schema_migrations WHERE id = $1")) {
            const id = String(values[0]);
            return { rows: (applied.has(id) ? [{ id }] : []) as unknown as readonly Row[] };
          }
          if (text.includes("INSERT INTO schema_migrations")) applied.add(String(values[0]));
          return { rows: [] };
        },
        async transaction<U>(nested: (tx: SqlClient) => Promise<U>): Promise<U> {
          return nested(tx);
        },
      };
      return work(tx);
    },
  };
  return { client, queries, applied, get transactions() { return transactions; } };
}

describe("runMigrations", () => {
  it("applies each pending migration under an advisory lock and records it atomically", async () => {
    const fake = createClient();
    const result = await runMigrations(fake.client, [
      { id: "001_initial", sql: "CREATE TABLE sample_a (id integer)" },
      { id: "002_next", sql: "ALTER TABLE sample_a ADD COLUMN name text" },
    ]);

    expect(result).toEqual(["001_initial", "002_next"]);
    expect(fake.transactions).toBe(2);
    expect(fake.queries.filter((query) => query.text.includes("pg_advisory_xact_lock"))).toHaveLength(2);
    expect(fake.queries.filter((query) => query.text.includes("INSERT INTO schema_migrations"))).toHaveLength(2);
    expect(fake.applied.has("001_initial")).toBe(true);
    expect(fake.applied.has("002_next")).toBe(true);
  });

  it("skips migrations already recorded in the database", async () => {
    const fake = createClient(["001_initial"]);
    const result = await runMigrations(fake.client, [
      { id: "001_initial", sql: "THIS MUST NOT RUN" },
      { id: "002_next", sql: "CREATE TABLE sample_b (id integer)" },
    ]);

    expect(result).toEqual(["002_next"]);
    expect(fake.queries.some((query) => query.text === "THIS MUST NOT RUN")).toBe(false);
    expect(fake.queries.filter((query) => query.text.includes("pg_advisory_xact_lock"))).toHaveLength(2);
  });

  it("does not record a migration when its SQL fails", async () => {
    const applied = new Set<string>();
    const queries: Query[] = [];
    const client: SqlClient = {
      async query<Row extends Record<string, unknown> = Record<string, unknown>>(text: string, values: readonly unknown[] = []): Promise<SqlQueryResult<Row>> {
        queries.push({ text, values });
        return { rows: [] };
      },
      async transaction<T>(work: (tx: SqlClient) => Promise<T>): Promise<T> {
        const tx: SqlClient = {
          async query<Row extends Record<string, unknown> = Record<string, unknown>>(text: string, values: readonly unknown[] = []): Promise<SqlQueryResult<Row>> {
            queries.push({ text, values });
            if (text.includes("SELECT id FROM schema_migrations WHERE id = $1")) return { rows: [] };
            if (text === "BROKEN MIGRATION") throw new Error("migration failed");
            if (text.includes("INSERT INTO schema_migrations")) applied.add(String(values[0]));
            return { rows: [] };
          },
          async transaction<U>(nested: (tx: SqlClient) => Promise<U>): Promise<U> { return nested(tx); },
        };
        return work(tx);
      },
    };

    await expect(runMigrations(client, [{ id: "001_broken", sql: "BROKEN MIGRATION" }]))
      .rejects.toThrow("migration failed");
    expect(applied.has("001_broken")).toBe(false);
    expect(queries.some((query) => query.text.includes("INSERT INTO schema_migrations"))).toBe(false);
  });
});
