import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { WritingRunRecord } from "@/lib/writing-run-types";

const STORE_DIR = path.join(process.cwd(), ".writing-runs");

export type RunStore = {
  pathFor(runId: string): string;
  put(run: WritingRunRecord): Promise<void>;
  get(runId: string): Promise<WritingRunRecord>;
  list(): Promise<WritingRunRecord[]>;
};

async function ensureStore() {
  await mkdir(STORE_DIR, { recursive: true });
}

export const jsonRunStore: RunStore = {
  pathFor(runId: string) {
    return path.join(STORE_DIR, `${runId}.json`);
  },

  async put(run: WritingRunRecord) {
    await ensureStore();
    await writeFile(this.pathFor(run.id), `${JSON.stringify(run, null, 2)}\n`, "utf8");
  },

  async get(runId: string) {
    const content = await readFile(this.pathFor(runId), "utf8");
    return JSON.parse(content) as WritingRunRecord;
  },

  async list() {
    await ensureStore();
    const files = await readdir(STORE_DIR);
    const runs = await Promise.all(
      files
        .filter((file) => file.endsWith(".json"))
        .map(async (file) => JSON.parse(await readFile(path.join(STORE_DIR, file), "utf8")) as WritingRunRecord),
    );

    return runs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
};
