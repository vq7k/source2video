import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { RulePackageRecord } from "@doc-maker/writing-domain/types";

function storeDir() {
  return process.env.DOC_MAKER_RULE_PACKAGE_STORE_DIR ||
    path.join(process.env.DOC_MAKER_RUN_STORE_DIR || path.join(process.cwd(), ".writing-runs"), "rule-packages");
}

async function ensureStore() {
  await mkdir(storeDir(), { recursive: true });
}

export const jsonRulePackageStore = {
  pathFor(packageId: string) {
    return path.join(storeDir(), `${packageId}.json`);
  },

  async put(rulePackage: RulePackageRecord) {
    await ensureStore();
    await writeFile(this.pathFor(rulePackage.id), `${JSON.stringify(rulePackage, null, 2)}\n`, "utf8");
  },

  async get(packageId: string) {
    const content = await readFile(this.pathFor(packageId), "utf8");
    return JSON.parse(content) as RulePackageRecord;
  },

  async list() {
    await ensureStore();
    const dir = storeDir();
    const files = await readdir(dir);
    const packages = await Promise.all(
      files
        .filter((file) => file.endsWith(".json"))
        .map(async (file) => JSON.parse(await readFile(path.join(dir, file), "utf8")) as RulePackageRecord),
    );

    return packages.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
};
