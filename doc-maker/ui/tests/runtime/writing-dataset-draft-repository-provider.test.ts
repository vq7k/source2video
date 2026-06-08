import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import fixture from "../fixtures/l1-writing-regression.json";
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

const createPgSqlClient = vi.fn();
const createPostgresDatasetRepository = vi.fn();
const runFrameworkStoreMigrations = vi.fn();

vi.mock("@source2video/framework-store", () => ({
  createPgSqlClient,
  createPostgresDatasetRepository,
  runFrameworkStoreMigrations,
}));

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

  async getDataset(datasetId: string): Promise<FrameworkDatasetRecord | null> {
    return this.datasets.get(datasetId) ?? null;
  }

  async putDataset(dataset: FrameworkDatasetRecord): Promise<FrameworkDatasetRecord> {
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

describe("writing dataset draft repository provider", () => {
  beforeEach(async () => {
    vi.resetModules();
    createPgSqlClient.mockReset();
    createPostgresDatasetRepository.mockReset();
    runFrameworkStoreMigrations.mockReset();
    runFrameworkStoreMigrations.mockResolvedValue([]);
    delete process.env.FRAMEWORK_DATABASE_URL;

    storeDir = await mkdtemp(path.join(os.tmpdir(), "doc-maker-dataset-provider-"));
    process.env.DOC_MAKER_RUN_STORE_DIR = storeDir;
    process.env.DOC_MAKER_LLM_PROVIDER = "mock";
  });

  afterEach(async () => {
    delete process.env.FRAMEWORK_DATABASE_URL;
    delete process.env.DOC_MAKER_RUN_STORE_DIR;
    delete process.env.DOC_MAKER_LLM_PROVIDER;
    await rm(storeDir, { recursive: true, force: true });
  });

  it("builds a postgres-backed repository from FRAMEWORK_DATABASE_URL and caches the client", async () => {
    process.env.FRAMEWORK_DATABASE_URL = "postgres://framework:secret@db.internal:5432/framework";
    const fakeClient = { marker: "pg-sql-client" };
    const fakeRepository = new FakeDatasetRepository();
    createPgSqlClient.mockReturnValue(fakeClient);
    createPostgresDatasetRepository.mockReturnValue(fakeRepository);

    const mod = await import("@/lib/writing-dataset-draft-repository");
    const repository = mod.getWritingDatasetDraftRepository();

    expect(repository).not.toBeNull();
    expect(createPgSqlClient).toHaveBeenCalledTimes(1);
    expect(createPgSqlClient).toHaveBeenCalledWith({
      connectionString: "postgres://framework:secret@db.internal:5432/framework",
    });
    expect(createPostgresDatasetRepository).toHaveBeenCalledWith(fakeClient);

    const again = mod.getWritingDatasetDraftRepository();
    expect(again).toBe(repository);
    expect(createPgSqlClient).toHaveBeenCalledTimes(1);
  });

  it("runs framework store migrations before first dataset repository access", async () => {
    process.env.FRAMEWORK_DATABASE_URL = "postgres://framework:secret@db.internal:5432/framework";
    const callOrder: string[] = [];
    const fakeClient = { marker: "pg-sql-client" };
    const fakeRepository = new FakeDatasetRepository();
    createPgSqlClient.mockReturnValue(fakeClient);
    createPostgresDatasetRepository.mockReturnValue({
      ...fakeRepository,
      getDataset: async (datasetId: string) => {
        callOrder.push(`get:${datasetId}`);
        return fakeRepository.getDataset(datasetId);
      },
      putDataset: async (dataset: FrameworkDatasetRecord) => {
        callOrder.push(`put:${dataset.id}`);
        return fakeRepository.putDataset(dataset);
      },
      appendDatasetItem: async (datasetId: string, item: FrameworkDatasetItem) => {
        callOrder.push(`append:${datasetId}`);
        return fakeRepository.appendDatasetItem(datasetId, item);
      },
    });
    runFrameworkStoreMigrations.mockImplementation(async () => {
      callOrder.push("migrate");
    });

    const mod = await import("@/lib/writing-dataset-draft-repository");
    const repository = mod.getWritingDatasetDraftRepository();

    expect(repository).not.toBeNull();
    await repository!.getDataset?.("writing_dataset_draft");
    await repository!.getDataset?.("writing_eval_dataset");

    expect(runFrameworkStoreMigrations).toHaveBeenCalledTimes(1);
    expect(runFrameworkStoreMigrations).toHaveBeenCalledWith(fakeClient);
    expect(callOrder).toEqual(["migrate", "get:writing_dataset_draft", "get:writing_eval_dataset"]);
  });

  it("returns null (keeping the 503 path) when FRAMEWORK_DATABASE_URL is unset", async () => {
    const mod = await import("@/lib/writing-dataset-draft-repository");

    expect(mod.getWritingDatasetDraftRepository()).toBeNull();
    expect(createPgSqlClient).not.toHaveBeenCalled();
  });

  it("prefers a test override provider over the env-driven default", async () => {
    process.env.FRAMEWORK_DATABASE_URL = "postgres://framework:secret@db.internal:5432/framework";
    const override = new FakeDatasetRepository();

    const mod = await import("@/lib/writing-dataset-draft-repository");
    mod.setWritingDatasetDraftRepositoryProviderForTests(() => override);
    try {
      expect(mod.getWritingDatasetDraftRepository()).toBe(override);
      expect(createPgSqlClient).not.toHaveBeenCalled();
    } finally {
      mod.setWritingDatasetDraftRepositoryProviderForTests(null);
    }
  });

  it("drives the dataset-drafts API route off the env-configured repository (non-503)", async () => {
    process.env.FRAMEWORK_DATABASE_URL = "postgres://framework:secret@db.internal:5432/framework";
    const repository = new FakeDatasetRepository();
    createPgSqlClient.mockReturnValue({ marker: "pg-sql-client" });
    createPostgresDatasetRepository.mockReturnValue(repository);

    const run = await createRunWithDatasetDraft();
    const routeModule = (await import("@/app/api/writing-runs/[runId]/dataset-drafts/route")) as {
      POST: (
        request: Request,
        context: { params: Promise<{ runId: string }> },
      ) => Promise<Response>;
    };

    const response = await routeModule.POST(
      new Request("http://localhost/api/writing-runs/run-id/dataset-drafts", { method: "POST" }),
      { params: Promise.resolve({ runId: run.id }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.dataset).toEqual(
      expect.objectContaining({
        id: "writing_dataset_draft",
        kind: "writing_dataset_draft",
        version: "draft",
        itemCount: 1,
      }),
    );
    expect(createPgSqlClient).toHaveBeenCalledWith({
      connectionString: "postgres://framework:secret@db.internal:5432/framework",
    });
    expect(runFrameworkStoreMigrations).toHaveBeenCalledTimes(1);
    expect(repository.appended).toHaveLength(1);
  });
});
