import { Pool, type PoolClient, type QueryResultRow } from "pg";
import type { SqlClient, SqlQueryResult } from "./postgres.js";

export interface PostgresClientOptions {
  readonly connectionString?: string;
  readonly max?: number;
  readonly idleTimeoutMillis?: number;
  readonly connectionTimeoutMillis?: number;
  readonly ssl?: boolean | { readonly rejectUnauthorized?: boolean };
}

function queryResult<Row extends Record<string, unknown>>(result: { rows: readonly QueryResultRow[] }): SqlQueryResult<Row> {
  return { rows: result.rows as readonly Row[] };
}

class PostgresTransactionClient implements SqlClient {
  public constructor(private readonly client: PoolClient) {}

  async query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<SqlQueryResult<Row>> {
    const result = await this.client.query(text, values as unknown[] | undefined);
    return queryResult<Row>(result);
  }

  async transaction<T>(work: (client: SqlClient) => Promise<T>): Promise<T> {
    return work(this);
  }
}

export class PostgresPoolClient implements SqlClient {
  public constructor(private readonly pool: Pool) {}

  async query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<SqlQueryResult<Row>> {
    const result = await this.pool.query(text, values as unknown[] | undefined);
    return queryResult<Row>(result);
  }

  async transaction<T>(work: (client: SqlClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await work(new PostgresTransactionClient(client));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the original failure; rollback failure is operational telemetry.
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export function createPostgresClient(options: PostgresClientOptions = {}): PostgresPoolClient {
  const pool = new Pool({
    connectionString: options.connectionString ?? process.env.DATABASE_URL,
    max: options.max,
    idleTimeoutMillis: options.idleTimeoutMillis,
    connectionTimeoutMillis: options.connectionTimeoutMillis,
    ssl: options.ssl,
  });
  return new PostgresPoolClient(pool);
}
