import type { SqlClient } from "./postgres.js";

export interface Migration {
  readonly id: string;
  readonly sql: string;
}

export async function runMigrations(
  client: SqlClient,
  migrations: readonly Migration[],
): Promise<readonly string[]> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const appliedResult = await client.query<{ id: string }>(
    "SELECT id FROM schema_migrations ORDER BY id ASC",
  );
  const applied = new Set(appliedResult.rows.map((row) => row.id));
  const executed: string[] = [];

  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;

    await client.transaction(async (tx) => {
      await tx.query(migration.sql);
      await tx.query("INSERT INTO schema_migrations (id) VALUES ($1)", [migration.id]);
    });

    executed.push(migration.id);
  }

  return executed;
}
