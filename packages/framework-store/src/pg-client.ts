import { Pool as PgPool } from "pg";
import type { Pool, PoolConfig } from "pg";

import type { FrameworkSqlClient, FrameworkSqlResult } from "./db";

/**
 * Construction input for {@link createPgSqlClient}.
 *
 * - Pass a `connectionString` (with optional extra `poolConfig`) to let the
 *   adapter create and own an internal `pg.Pool`; `close()` will end it.
 * - Pass an existing `pool` to reuse a caller-managed `pg.Pool`; `close()` is a
 *   no-op unless `ownsPool` is set, so the caller keeps control of its lifecycle.
 */
export type PgSqlClientInput =
  | { connectionString: string; poolConfig?: Omit<PoolConfig, "connectionString"> }
  | { pool: Pool; ownsPool?: boolean };

/**
 * A {@link FrameworkSqlClient} backed by node-postgres, with access to the
 * underlying pool and a lifecycle-aware `close()`.
 */
export type PgSqlClient = FrameworkSqlClient & {
  /** The underlying node-postgres pool, exposed for diagnostics or reuse. */
  readonly pool: Pool;
  /**
   * Ends the underlying pool when this client owns it (created from a
   * connection string, or an injected pool flagged with `ownsPool`).
   * No-op for injected pools the caller still manages.
   */
  close(): Promise<void>;
};

/**
 * Adapts a node-postgres `Pool` to the generic {@link FrameworkSqlClient}
 * contract. Business-agnostic: any framework repository (workflow runs,
 * artifacts, jobs, datasets, ...) can be backed by Postgres through this client.
 */
export function createPgSqlClient(input: PgSqlClientInput): PgSqlClient {
  let pool: Pool;
  let ownsPool: boolean;

  if ("pool" in input) {
    pool = input.pool;
    ownsPool = input.ownsPool ?? false;
  } else {
    pool = new PgPool({ connectionString: input.connectionString, ...input.poolConfig });
    ownsPool = true;
  }

  return {
    pool,
    async query<T>(sql: string, parameters?: readonly unknown[]): Promise<FrameworkSqlResult<T>> {
      const result = await pool.query(sql, parameters as unknown[] | undefined);

      return { rows: result.rows as T[] };
    },
    async close(): Promise<void> {
      if (ownsPool) {
        await pool.end();
      }
    },
  };
}
