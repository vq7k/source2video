import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, "../../../..");
const uiRoot = path.resolve(repoRoot, "doc-maker/ui");

function exists(relativePath: string): boolean {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function readText(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("framework package topology", () => {
  it("keeps generic framework packages at the repository root", () => {
    const genericPackages = [
      "workflow-core",
      "observability",
      "framework-store",
      "framework-runtime",
      "artifact-store",
    ];

    for (const packageName of genericPackages) {
      expect(exists(`packages/${packageName}/src/index.ts`), packageName).toBe(true);
      expect(exists(`doc-maker/packages/${packageName}`), packageName).toBe(false);
    }
  });

  it("points TypeScript and Vitest aliases at root framework packages", () => {
    const tsconfig = JSON.parse(readText("doc-maker/ui/tsconfig.json")) as {
      compilerOptions: { paths: Record<string, string[]> };
    };
    const paths = tsconfig.compilerOptions.paths;

    expect(paths["@source2video/workflow-core/*"]).toEqual(["../../packages/workflow-core/src/*"]);
    expect(paths["@source2video/observability/*"]).toEqual(["../../packages/observability/src/*"]);
    expect(paths["@doc-maker/writing-domain/*"]).toEqual(["../packages/writing-domain/src/*"]);

    const vitestConfig = fs.readFileSync(path.join(uiRoot, "vitest.config.ts"), "utf8");
    expect(vitestConfig).toContain(
      `"@source2video/workflow-core": path.resolve(dirname, "../../packages/workflow-core/src")`,
    );
    expect(vitestConfig).toContain(
      `"@source2video/observability": path.resolve(dirname, "../../packages/observability/src")`,
    );
    const legacyWorkflowAlias = ["@doc-maker", "workflow-core"].join("/");
    const legacyObservabilityAlias = ["@doc-maker", "observability"].join("/");

    expect(vitestConfig).not.toContain(
      `"${legacyWorkflowAlias}": path.resolve(dirname, "../packages/workflow-core/src")`,
    );
    expect(vitestConfig).not.toContain(
      `"${legacyObservabilityAlias}": path.resolve(dirname, "../packages/observability/src")`,
    );
  });

  it("keeps source imports on public package aliases instead of legacy doc-maker framework aliases", () => {
    const sourceFiles = [
      ...fs.globSync("packages/**/*.ts", { cwd: repoRoot }),
      ...fs.globSync("doc-maker/packages/**/*.ts", { cwd: repoRoot }),
      ...fs.globSync("doc-maker/ui/app/**/*.ts", { cwd: repoRoot }),
      ...fs.globSync("doc-maker/ui/app/**/*.tsx", { cwd: repoRoot }),
      ...fs.globSync("doc-maker/ui/tests/**/*.ts", { cwd: repoRoot }),
    ];

    const legacyImports = sourceFiles.flatMap((relativePath) => {
      const content = readText(relativePath);
      const legacyImportPattern = new RegExp(`${["@doc-maker", "(?:workflow-core|observability)"].join("\\/")}`, "g");
      const matches = content.match(legacyImportPattern) ?? [];
      return matches.map((match) => `${relativePath}: ${match}`);
    });

    expect(legacyImports).toEqual([]);
  });

  it("keeps root framework packages free from doc-maker business metadata", () => {
    const frameworkFiles = fs.globSync("packages/**/*.ts", { cwd: repoRoot });
    const businessMetadata = frameworkFiles.flatMap((relativePath) => {
      const content = readText(relativePath);
      const matches = content.match(/\bdoc-maker(?:-ui)?\b/g) ?? [];
      return matches.map((match) => `${relativePath}: ${match}`);
    });

    expect(businessMetadata).toEqual([]);
  });

  it("includes root framework packages in the production Docker build context", () => {
    const dockerfile = readText("Dockerfile");

    expect(dockerfile).toContain("COPY packages ./packages");
  });
});
