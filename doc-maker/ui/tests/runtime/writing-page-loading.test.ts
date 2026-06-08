import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, "../../../..");

function readText(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("writing page loading state", () => {
  it("reserves the initial workspace layout while saved runs are loading", () => {
    const page = readText("doc-maker/ui/app/writing/page.tsx");

    expect(page).toContain("const [loadingRuns, setLoadingRuns] = useState(true)");
    expect(page).toContain("const initialWorkspaceLoading = loadingRuns && runs.length === 0");
    expect(page).toContain("{initialWorkspaceLoading ? <WritingWorkspaceLoading /> : null}");
    expect(page).toContain("@/components/writing-production/workspace-loading");
    expect(page).toContain('aria-busy={initialWorkspaceLoading ? "true" : undefined}');
  });
});
