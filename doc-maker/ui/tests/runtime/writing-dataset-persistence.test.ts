import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import fixture from "../fixtures/l1-writing-regression.json";
import { buildWritingAdapterReadinessProjection } from "@doc-maker/writing-domain/adapter-readiness";
import {
  compileRulePatch,
  confirmWritingRunPrecheck,
  createRulePackageDraft,
  createWritingRun,
  finalizeWritingRun,
  recordHumanFeedback,
} from "@doc-maker/writing-domain/runtime";
import type { CreateWritingRunInput, WritingRunRecord } from "@doc-maker/writing-domain/types";
import type {
  FrameworkDatasetItem,
  FrameworkDatasetRecord,
} from "../../../../packages/framework-store/src/index";

function createInput(): CreateWritingRunInput {
  return {
    quickIntake: fixture.quickIntake,
    referencePaste: "参考语气：克制、具体，避免营销腔。",
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
      artifactType: "讲解文档包",
      lengthRange: "600-900 字",
      structure: "先给结论，再展开依据和边界",
      formatRules: "使用小标题和短段落",
      groundingRules: "只使用输入材料和用户补充事实",
      specialHandling: "不引入视频、TTS 或视觉脚本要求",
      downstreamHandoff: "交给人工编辑确认后发布",
    },
    jobSpec: {
      title: fixture.quickIntake,
      goal: "围绕本次输入生成一个可直接阅读的文本版本；优先明确核心判断，避免扩散到新主题。",
      source: fixture.quickIntake,
      writingReference: "参考语气：克制、具体。",
      reviewPreference: "偏好结构清楚、少形容词。",
    },
  };
}

class FakeDatasetRepository {
  readonly datasets = new Map<string, FrameworkDatasetRecord>();
  readonly appended: Array<{ datasetId: string; item: FrameworkDatasetItem }> = [];
  readonly putDatasets: FrameworkDatasetRecord[] = [];

  async getDataset(datasetId: string): Promise<FrameworkDatasetRecord | null> {
    return this.datasets.get(datasetId) ?? null;
  }

  async putDataset(dataset: FrameworkDatasetRecord): Promise<FrameworkDatasetRecord> {
    this.putDatasets.push(dataset);
    this.datasets.set(dataset.id, dataset);
    return dataset;
  }

  async appendDatasetItem(
    datasetId: string,
    item: FrameworkDatasetItem,
  ): Promise<FrameworkDatasetRecord> {
    this.appended.push({ datasetId, item });
    const dataset = this.datasets.get(datasetId);
    if (!dataset) {
      throw new Error(`Missing dataset ${datasetId}`);
    }
    const nextDataset = {
      ...dataset,
      items: [...dataset.items.filter((existing) => existing.id !== item.id), item],
      updatedAt: dataset.updatedAt,
    };
    this.datasets.set(datasetId, nextDataset);
    return nextDataset;
  }
}

async function createRunWithDatasetDraft(): Promise<WritingRunRecord> {
  const draft = await createWritingRun(createInput());
  const confirmed = await confirmWritingRunPrecheck(draft.id);
  const candidate = confirmed.candidates[0];
  const withFeedback = await recordHumanFeedback(confirmed.id, {
    candidateId: candidate.id,
    verdict: "rewrite",
    quote: "表达略泛",
    issue: "需要补充具体边界",
    expected: "说明哪些内容不会展开",
    businessReason: "结构问题",
    likelyCause: "prompt",
    confidence: "high",
  });
  const withPatch = await compileRulePatch(withFeedback.id, { candidateId: candidate.id });
  const finalized = await finalizeWritingRun(withPatch.id, { candidateId: candidate.id });
  const { run } = await createRulePackageDraft(finalized.id, { candidateId: candidate.id });
  return run;
}

let storeDir: string;

describe("writing dataset draft persistence", () => {
  beforeEach(async () => {
    storeDir = await mkdtemp(path.join(os.tmpdir(), "doc-maker-dataset-persistence-"));
    process.env.DOC_MAKER_RUN_STORE_DIR = storeDir;
    process.env.DOC_MAKER_LLM_PROVIDER = "mock";
  });

  afterEach(async () => {
    delete process.env.DOC_MAKER_RUN_STORE_DIR;
    delete process.env.DOC_MAKER_LLM_PROVIDER;
    await rm(storeDir, { recursive: true, force: true });
  });

  it("persists Writing feedback dataset drafts into the fixed framework dataset", async () => {
    const run = await createRunWithDatasetDraft();
    const projection = buildWritingAdapterReadinessProjection(run);
    expect(projection.datasetDraftItems).toHaveLength(1);

    const persistenceModule = (await import("@doc-maker/writing-domain/dataset-draft-persistence")) as {
      WRITING_DATASET_DRAFT_ID: string;
      persistWritingDatasetDraftsForRun: (
        run: WritingRunRecord,
        repository: FakeDatasetRepository,
        options?: { at?: string },
      ) => Promise<{ dataset: FrameworkDatasetRecord; items: FrameworkDatasetItem[] }>;
    };
    const repository = new FakeDatasetRepository();
    const at = "2026-06-05T00:00:00.000Z";

    const result = await persistenceModule.persistWritingDatasetDraftsForRun(run, repository, { at });

    expect(persistenceModule.WRITING_DATASET_DRAFT_ID).toBe("writing_dataset_draft");
    expect(repository.putDatasets).toEqual([
      expect.objectContaining({
        id: "writing_dataset_draft",
        kind: "writing_dataset_draft",
        version: "draft",
      }),
    ]);
    expect(result.dataset.id).toBe("writing_dataset_draft");
    expect(result.items).toHaveLength(1);
    expect(repository.appended).toEqual([
      expect.objectContaining({
        datasetId: "writing_dataset_draft",
        item: expect.objectContaining({
          datasetId: "writing_dataset_draft",
          sourceRunId: run.id,
          sourceArtifactId: run.candidates[0].id,
          split: "draft",
        }),
      }),
    ]);
    expect(result.items[0]?.metadata).toEqual(
      expect.objectContaining({
        domain: "writing",
        reviewStatus: "needs_human_confirmation",
      }),
    );
  });

  it("persists dataset drafts through the writing run API route when a repository is configured", async () => {
    const run = await createRunWithDatasetDraft();
    const repository = new FakeDatasetRepository();
    const routeModule = (await import("../../app/api/writing-runs/[runId]/dataset-drafts/route")) as {
      POST: (
        request: Request,
        context: { params: { runId: string } },
      ) => Promise<Response>;
      setWritingDatasetDraftRepositoryProviderForTests: (
        provider: (() => FakeDatasetRepository) | null,
      ) => void;
    };

    routeModule.setWritingDatasetDraftRepositoryProviderForTests(() => repository);
    try {
      const response = await routeModule.POST(new Request("http://localhost/api/writing-runs/run-id/dataset-drafts", {
        method: "POST",
      }), {
        params: { runId: run.id },
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual(
        expect.objectContaining({
          dataset: expect.objectContaining({
            id: "writing_dataset_draft",
            kind: "writing_dataset_draft",
            version: "draft",
            itemCount: 1,
          }),
          items: [
            expect.objectContaining({
              id: `dataset_draft_${run.id}_${run.feedback[0].id}`,
              datasetId: "writing_dataset_draft",
              sourceRunId: run.id,
              sourceArtifactId: run.candidates[0].id,
              split: "draft",
            }),
          ],
        }),
      );
      expect(repository.appended).toHaveLength(1);
    } finally {
      routeModule.setWritingDatasetDraftRepositoryProviderForTests(null);
    }
  });

  it("returns 503 from the API route when no dataset repository is configured", async () => {
    const routeModule = (await import("../../app/api/writing-runs/[runId]/dataset-drafts/route")) as {
      POST: (
        request: Request,
        context: { params: { runId: string } },
      ) => Promise<Response>;
      setWritingDatasetDraftRepositoryProviderForTests: (
        provider: (() => FakeDatasetRepository) | null,
      ) => void;
    };
    routeModule.setWritingDatasetDraftRepositoryProviderForTests(null);

    const response = await routeModule.POST(new Request("http://localhost/api/writing-runs/run-id/dataset-drafts", {
      method: "POST",
    }), {
      params: { runId: "missing-run" },
    });
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: "Writing dataset repository is not configured",
      status: "repository_unconfigured",
    });
  });
});
