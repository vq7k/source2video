import { expect, test } from "@playwright/test";

import fixture from "../fixtures/l1-writing-regression.json";

const baselineSkillPackage = {
  id: "baseline-no-package",
  category: "本次文本",
  version: "Baseline / No Published Rule Package",
  status: "baseline mode",
};

const baselineOutputProfile = {
  name: "文本产物",
  artifacts: ["text_artifact"],
};

const emptyOutputContract = {
  artifactType: "",
  lengthRange: "",
  structure: "",
  formatRules: "",
  groundingRules: "",
  specialHandling: "",
  downstreamHandoff: "",
};

test("framework trace deep link selects the exact call and shows score sink status", async ({ page, request }) => {
  const created = await request.post("/api/writing-runs", {
    data: {
      quickIntake: fixture.quickIntake,
      referencePaste: "",
      skillPackage: baselineSkillPackage,
      outputProfile: baselineOutputProfile,
      outputContract: emptyOutputContract,
      jobSpec: {
        title: fixture.quickIntake,
        goal: "围绕本次输入生成一个可直接阅读的文本版本；优先明确核心判断，避免扩散到新主题。",
        source: fixture.quickIntake,
        writingReference: "",
        reviewPreference: "",
      },
    },
  });
  expect(created.ok()).toBe(true);
  const createdBody = await created.json();

  const confirmed = await request.post(`/api/writing-runs/${createdBody.run.id}/confirm`);
  expect(confirmed.ok()).toBe(true);
  const confirmedBody = await confirmed.json();
  const trace = confirmedBody.run.llmTraces.find(
    (item: { nodeType?: string; metadata?: Record<string, unknown> }) =>
      item.nodeType === "candidate_eval" && item.metadata?.scoreSinkStatus,
  );
  expect(trace).toBeTruthy();

  await page.goto(`/framework?runId=${confirmedBody.run.id}&traceId=${trace.id}&returnTo=/writing`);

  await expect(page.getByText("候选评估").first()).toBeVisible();
  await expect(page.getByText("Trace 已定位")).toBeVisible();
  await expect(page.getByText(trace.id).first()).toBeVisible();
  await expect(page.getByText(/(local-json|langfuse) \/ (skipped|complete|failed) \/ [1-9]/).first()).toBeVisible();
});
