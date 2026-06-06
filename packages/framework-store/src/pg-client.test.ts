import { describe, expect, it } from "vitest";

import type { Pool } from "pg";

import { createPgSqlClient } from "./pg-client";

type RecordedCall = { text: string; values: readonly unknown[] | undefined };

function createFakePool(rowsToReturn: readonly unknown[] = []) {
  const calls: RecordedCall[] = [];
  let endedCount = 0;

  const pool = {
    async query(text: string, values?: readonly unknown[]) {
      calls.push({ text, values });
      return { rows: [...rowsToReturn], rowCount: rowsToReturn.length };
    },
    async end() {
      endedCount += 1;
    },
  };

  return {
    pool: pool as unknown as Pool,
    calls,
    endedCount: () => endedCount,
  };
}

describe("createPgSqlClient", () => {
  it("passes sql and parameters through to the pool and returns the rows verbatim", async () => {
    const fake = createFakePool([
      { id: "a", value: 1 },
      { id: "b", value: 2 },
    ]);
    const client = createPgSqlClient({ pool: fake.pool });

    const result = await client.query<{ id: string; value: number }>(
      "select id, value from things where id = $1",
      ["a"],
    );

    // Generic T is honored at the type level.
    const firstId: string = result.rows[0]?.id ?? "";

    expect(firstId).toBe("a");
    expect(result.rows).toEqual([
      { id: "a", value: 1 },
      { id: "b", value: 2 },
    ]);
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.text).toBe("select id, value from things where id = $1");
    expect(fake.calls[0]?.values).toEqual(["a"]);
  });

  it("passes parameters through untouched when omitted", async () => {
    const fake = createFakePool([{ ok: true }]);
    const client = createPgSqlClient({ pool: fake.pool });

    await client.query("select 1");

    expect(fake.calls[0]?.values).toBeUndefined();
  });

  it("builds an internal pool from a connection string and exposes a working close()", async () => {
    const client = createPgSqlClient({ connectionString: "postgres://user:pass@localhost:5432/example" });

    expect(client.pool).toBeDefined();
    expect(typeof client.close).toBe("function");
    // No query is issued, so end() resolves without opening a connection.
    await expect(client.close()).resolves.toBeUndefined();
  });

  it("does not end an injected pool on close (caller owns its lifecycle)", async () => {
    const fake = createFakePool();
    const client = createPgSqlClient({ pool: fake.pool });

    await client.close();

    expect(fake.endedCount()).toBe(0);
  });

  it("ends an internally-owned pool on close", async () => {
    const fake = createFakePool();
    const client = createPgSqlClient({ pool: fake.pool, ownsPool: true });

    await client.close();

    expect(fake.endedCount()).toBe(1);
  });
});
