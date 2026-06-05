import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type FrameworkMigration = {
  id: string;
  sql: string;
  checksum: string;
};

export type FrameworkMigrationClient = {
  query(sql: string, parameters?: readonly unknown[]): Promise<unknown>;
};

const dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(dirname, "../migrations");

function readMigration(id: string): FrameworkMigration {
  const sql = fs.readFileSync(path.join(migrationsDir, `${id}.sql`), "utf8");

  return {
    id,
    sql,
    checksum: createHash("sha256").update(sql).digest("hex"),
  };
}

export const frameworkMigrations: FrameworkMigration[] = [
  readMigration("0001_framework_core"),
];

export async function runFrameworkStoreMigrations(client: FrameworkMigrationClient) {
  await client.query(`
    create table if not exists framework_schema_migrations (
      id text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    )
  `);

  for (const migration of frameworkMigrations) {
    await client.query(migration.sql);
    await client.query(
      `
        insert into framework_schema_migrations (id, checksum)
        values ($1, $2)
        on conflict (id) do update
          set checksum = excluded.checksum
      `,
      [migration.id, migration.checksum],
    );
  }

  return frameworkMigrations.map((migration) => migration.id);
}
