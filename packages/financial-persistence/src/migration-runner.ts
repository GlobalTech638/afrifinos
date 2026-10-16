import type { SqlClient } from "./postgres.js";

export interface Migration {
  readonly id: string;
  readonly sql: string;
}

const MIGRATION_ADVISORY_LOCK_KEY = 684_992_401;

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

  const executed: string[] = [];
  for (const migration of migrations) {
    const wasApplied = await client.transaction(async (tx) => {
      // Lock and re-check inside the same transaction. This prevents two
      // application instances from applying the same migration concurrently.
      await tx.query("SELECT pg_advisory_xact_lock($1)", [MIGRATION_ADVISORY_LOCK_KEY]);
      const appliedResult = await tx.query<{ id: string }>(
        "SELECT id FROM schema_migrations WHERE id = $1",
        [migration.id],
      );
      if (appliedResult.rows.length > 0) return false;

      await tx.query(migration.sql);
      await tx.query("INSERT INTO schema_migrations (id) VALUES ($1)", [migration.id]);
      return true;
    });
    if (wasApplied) executed.push(migration.id);
  }

  return executed;
}
