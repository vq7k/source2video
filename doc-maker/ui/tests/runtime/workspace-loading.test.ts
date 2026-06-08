import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, "../../../..");

function readText(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("writing production workspace loading", () => {
  it("uses shared initial loading components across writing routes", () => {
    const loading = readText("doc-maker/ui/components/writing-production/workspace-loading.tsx");
    const writingPage = readText("doc-maker/ui/app/writing/page.tsx");
    const overviewPage = readText("doc-maker/ui/app/overview/page.tsx");

    expect(loading).toContain("export function WritingWorkspaceLoading()");
    expect(loading).toContain("export function WritingTopicListLoading()");
    expect(loading).toContain("export function OverviewWorkspaceLoading()");
    expect(writingPage).toContain("@/components/writing-production/workspace-loading");
    expect(overviewPage).toContain("@/components/writing-production/workspace-loading");
    expect(overviewPage).toContain("const initialWorkspaceLoading = !hasLoadedLatestRun");
    expect(overviewPage).toContain("<OverviewWorkspaceLoading />");
  });
});
