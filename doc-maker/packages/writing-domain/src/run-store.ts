import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { WritingRunRecord } from "@doc-maker/writing-domain/types";

function storeDir() {
  return process.env.DOC_MAKER_RUN_STORE_DIR || path.join(process.cwd(), ".writing-runs");
}

export type RunStore = {
  pathFor(runId: string): string;
  put(run: WritingRunRecord): Promise<void>;
  get(runId: string): Promise<WritingRunRecord | null>;
  list(): Promise<WritingRunRecord[]>;
};

async function ensureStore() {
  await mkdir(storeDir(), { recursive: true });
}

function isMissingStoreFile(error: unknown): boolean {
  return error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT";
}

export const jsonRunStore: RunStore = {
  pathFor(runId: string) {
    return path.join(storeDir(), `${runId}.json`);
  },

  async put(run: WritingRunRecord) {
    await ensureStore();
    await writeFile(this.pathFor(run.id), `${JSON.stringify(run, null, 2)}\n`, "utf8");
  },

  async get(runId: string) {
    try {
      const content = await readFile(this.pathFor(runId), "utf8");
      return JSON.parse(content) as WritingRunRecord;
    } catch (error) {
      if (isMissingStoreFile(error)) {
        return null;
      }
      throw error;
    }
  },

  async list() {
    await ensureStore();
    const dir = storeDir();
    const files = await readdir(dir);
    const runs = await Promise.all(
      files
        .filter((file) => file.endsWith(".json"))
        .map(async (file) => JSON.parse(await readFile(path.join(dir, file), "utf8")) as WritingRunRecord),
    );

    return runs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
};
