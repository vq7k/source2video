#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, "../../..");
const migrationPath = path.join(repoRoot, "packages/framework-store/migrations/0001_framework_core.sql");
const databaseUrl = process.env.FRAMEWORK_DATABASE_URL?.trim();

if (!databaseUrl) {
  console.error("FRAMEWORK_DATABASE_URL is required");
  process.exit(1);
}

if (!fs.existsSync(migrationPath)) {
  console.error(`Missing framework migration: ${migrationPath}`);
  process.exit(1);
}

const result = spawnSync(
  "psql",
  ["--set", "ON_ERROR_STOP=1", "--dbname", databaseUrl, "--file", migrationPath],
  {
    stdio: "inherit",
  },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 0);
