import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import fixture from "../fixtures/l1-writing-regression.json";
import {
  confirmWritingRunPrecheck,
  createWritingRun,
  finalizeWritingRun,
  recordHumanFeedback,
  runGenerationBatch,
} from "@doc-maker/writing-domain/runtime";
import { writingRunToWorkflowRun } from "@doc-maker/writing-domain/workflow-adapter";
import type { CreateWritingRunInput } from "@doc-maker/writing-domain/types";

let storeDir: string;

function createInput(): CreateWritingRunInput {
  return {
    quickIntake: fixture.quickIntake,
    referencePaste: "",
    skillPackage: {
      id: "baseline-no-package",
      category: "本次文本",
      version: "Baseline / No Published Rule Package",
      status: "baseline mode",
    },
    outputProfile: {
      name: "文本产物",
      artifacts: ["text_artifact"],
    },
    outputContract: {
      artifactType: "",
      lengthRange: "",
      structure: "",
      formatRules: "",
      groundingRules: "",
      specialHandling: "",
      downstreamHandoff: "",
    },
    jobSpec: {
      title: fixture.quickIntake,
      goal: "围绕本次输入生成一个可直接阅读的文本版本；优先明确核心判断，避免扩散到新主题。",
      source: fixture.quickIntake,
      writingReference: "",
      reviewPreference: "",
    },
  };
}

describe("writing runtime regression", () => {
  beforeEach(async () => {
    storeDir = await mkdtemp(path.join(os.tmpdir(), "doc-maker-writing-test-"));
    process.env.DOC_MAKER_RUN_STORE_DIR = storeDir;
    process.env.DOC_MAKER_LLM_PROVIDER = "mock";
  });

  afterEach(async () => {
    delete process.env.DOC_MAKER_RUN_STORE_DIR;
    delete process.env.DOC_MAKER_LLM_PROVIDER;
    await rm(storeDir, { recursive: true, force: true });
  });

  it("creates three independent candidates and three independent eval traces", async () => {
    const draft = await createWritingRun(createInput());
    expect(draft.status).toBe("precheck_ready");
    expect(draft.candidates).toHaveLength(0);

    const confirmed = await confirmWritingRunPrecheck(draft.id);
    const generation = confirmed.generationRuns.at(-1);

    expect(confirmed.status).toBe("candidate_ready");
    expect(confirmed.candidates).toHaveLength(fixture.expectedCandidateCount);
    expect(confirmed.evalRun?.candidateResults).toHaveLength(fixture.expectedCandidateCount);
    expect(generation?.executionMode).toBe("independent_candidate_paths");
    expect(generation?.candidateNodeRunIds).toHaveLength(fixture.expectedCandidateCount);
    expect(generation?.evalNodeRunIds).toHaveLength(fixture.expectedCandidateCount);
    const candidateGenerationTraces = confirmed.llmTraces?.filter((trace) => trace.nodeType === "candidate_generation") ?? [];
    expect(candidateGenerationTraces).toHaveLength(3);
    expect(candidateGenerationTraces.every((trace) => trace.status === "complete")).toBe(true);
    expect(confirmed.llmTraces?.filter((trace) => trace.nodeType === "candidate_eval")).toHaveLength(3);
  });

  it("keeps previous round candidates when generating a new round", async () => {
    const draft = await createWritingRun(createInput());
    const roundOne = await confirmWritingRunPrecheck(draft.id);
    const roundOneCandidateIds = roundOne.candidates.map((candidate) => candidate.id);

    const roundTwo = await runGenerationBatch(roundOne.id, { candidateCount: 3, patchIds: [] });

    expect(roundTwo.round).toBe(2);
    expect(roundTwo.candidates).toHaveLength(6);
    expect(roundTwo.candidates.slice(0, 3).map((candidate) => candidate.id)).toEqual(roundOneCandidateIds);
    expect(roundTwo.generationRuns).toHaveLength(2);
    expect(roundTwo.generationRuns[1]?.executionMode).toBe("independent_candidate_paths");
  });

  it("marks a candidate as finalized without deleting candidates", async () => {
    const draft = await createWritingRun(createInput());
    const confirmed = await confirmWritingRunPrecheck(draft.id);
    const candidate = confirmed.candidates[0];

    const finalized = await finalizeWritingRun(confirmed.id, { candidateId: candidate.id });

    expect(finalized.status).toBe("finalized");
    expect(finalized.finalizedCandidateId).toBe(candidate.id);
    expect(finalized.candidates).toHaveLength(3);
  });

  it("projects writing records into reusable workflow-core records", async () => {
    const draft = await createWritingRun(createInput());
    const confirmed = await confirmWritingRunPrecheck(draft.id);
    const candidate = confirmed.candidates[0];
    const withFeedback = await recordHumanFeedback(confirmed.id, {
      candidateId: candidate.id,
      verdict: "rewrite",
      issue: "需要更具体",
      expected: "补充边界和例子",
      confidence: "medium",
    });

    const workflow = writingRunToWorkflowRun(withFeedback);

    expect(workflow.domain).toBe("writing");
    expect(workflow.inputArtifacts).toHaveLength(1);
    expect(workflow.outputArtifacts).toHaveLength(3);
    expect(workflow.evalRuns).toHaveLength(1);
    expect(workflow.feedbackSignals).toHaveLength(1);
    expect(workflow.snapshots.length).toBeGreaterThanOrEqual(1);
    expect(workflow.nodeRuns.some((node) => node.nodeId === "candidate_generation")).toBe(true);
    expect(workflow.nodeRuns.some((node) => node.nodeId === "candidate_eval")).toBe(true);
  });
});
