import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { runMigrations, type Migration, type SqlClient } from "@afrifinos/financial-persistence";

const migrationFiles = [
  "001_initial_financial_schema.sql",
  "002_opaque_domain_ids.sql",
  "003_idempotency_and_integrity.sql",
] as const;

export async function loadApiMigrations(): Promise<readonly Migration[]> {
  const directory = join(process.cwd(), "packages", "financial-persistence", "migrations");
  return Promise.all(
    migrationFiles.map(async (id) => ({
      id,
      sql: await readFile(join(directory, id), "utf8"),
    })),
  );
}

export async function migrateDatabase(client: SqlClient): Promise<readonly string[]> {
  return runMigrations(client, await loadApiMigrations());
}
