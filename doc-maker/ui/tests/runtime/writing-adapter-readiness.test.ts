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
import type { CreateWritingRunInput } from "@doc-maker/writing-domain/types";
import type {
  FrameworkDatasetItem,
  FrameworkDatasetRecord,
} from "../../../../packages/framework-store/src/index";

type QueryResult<T> = {
  rows: T[];
};

type DatasetRow = {
  id: string;
  kind: string;
  version: string;
  created_at: string;
  updated_at: string;
  metadata_json: string;
};

type DatasetItemRow = {
  id: string;
  dataset_id: string;
  input_artifacts_json: string;
  expected_artifacts_json: string;
  metadata_json: string;
};

function compactSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim().toLowerCase();
}

class FakeDatasetSqlClient {
  readonly datasets = new Map<string, DatasetRow>();
  readonly items = new Map<string, DatasetItemRow[]>();
  readonly queries: Array<{ sql: string; parameters: readonly unknown[] }> = [];

  async query<T>(sql: string, parameters: readonly unknown[] = []): Promise<QueryResult<T>> {
    this.queries.push({ sql, parameters });
    const normalized = compactSql(sql);

    if (normalized.includes("insert into framework_datasets")) {
      const row: DatasetRow = {
        id: parameters[0] as string,
        kind: parameters[1] as string,
        version: parameters[2] as string,
        created_at: parameters[3] as string,
        updated_at: parameters[4] as string,
        metadata_json: parameters[5] as string,
      };
      this.datasets.set(row.id, row);
      return { rows: [row as T] };
    }

    if (normalized.includes("insert into framework_dataset_items")) {
      const row: DatasetItemRow = {
        id: parameters[0] as string,
        dataset_id: parameters[1] as string,
        input_artifacts_json: parameters[2] as string,
        expected_artifacts_json: parameters[3] as string,
        metadata_json: parameters[4] as string,
      };
      const rows = this.items.get(row.dataset_id) ?? [];
      const nextRows = rows.filter((item) => item.id !== row.id);
      nextRows.push(row);
      this.items.set(row.dataset_id, nextRows);
      return { rows: [row as T] };
    }

    if (normalized.includes("from framework_datasets") && normalized.includes("where id = $1")) {
      const row = this.datasets.get(parameters[0] as string);
      return { rows: row ? [row as T] : [] };
    }

    if (normalized.includes("from framework_datasets")) {
      return { rows: Array.from(this.datasets.values()) as T[] };
    }

    if (normalized.includes("from framework_dataset_items") && normalized.includes("where dataset_id = $1")) {
      return { rows: (this.items.get(parameters[0] as string) ?? []) as T[] };
    }

    throw new Error(`Unhandled SQL in fake client: ${normalized}`);
  }
}

let storeDir: string;

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

describe("writing adapter readiness", () => {
  beforeEach(async () => {
    storeDir = await mkdtemp(path.join(os.tmpdir(), "doc-maker-adapter-readiness-"));
    process.env.DOC_MAKER_RUN_STORE_DIR = storeDir;
    process.env.DOC_MAKER_LLM_PROVIDER = "mock";
  });

  afterEach(async () => {
    delete process.env.DOC_MAKER_RUN_STORE_DIR;
    delete process.env.DOC_MAKER_LLM_PROVIDER;
    await rm(storeDir, { recursive: true, force: true });
  });

  it("maps Writing JSON run, feedback, and rule package records into generic adapter drafts", async () => {
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
    const patch = withPatch.rulePatches.at(-1);
    expect(patch).toBeDefined();
    const finalized = await finalizeWritingRun(withPatch.id, { candidateId: candidate.id });
    const { run: withRulePackage, rulePackage } = await createRulePackageDraft(finalized.id, {
      candidateId: candidate.id,
    });

    const projection = buildWritingAdapterReadinessProjection(withRulePackage);

    expect(projection.workflowRun.domain).toBe("writing");
    expect(projection.workflowRun.feedbackSignals).toHaveLength(1);
    expect(projection.workflowRun.nodeRuns.some((node) => node.nodeId === "feedback_reasoning")).toBe(true);
    expect(projection.workflowRun.nodeRuns.some((node) => node.nodeId === "rule_patch_compilation")).toBe(true);
    expect(projection.rulePackageDrafts).toEqual([
      expect.objectContaining({
        id: rulePackage.id,
        sourceRunId: withRulePackage.id,
        finalizedCandidateId: candidate.id,
        status: "draft",
      }),
    ]);
    expect(projection.rulePackageDrafts[0]?.sourceSummary.feedbackRuleCount).toBeGreaterThanOrEqual(1);
    expect(projection.datasetDraftItems).toEqual([
      expect.objectContaining({
        id: `dataset_draft_${withRulePackage.id}_${withFeedback.feedback[0]?.id}`,
        sourceRunId: withRulePackage.id,
        candidateId: candidate.id,
        feedbackId: withFeedback.feedback[0]?.id,
        rulePatchId: patch?.id,
        status: "needs_human_confirmation",
      }),
    ]);
    expect(projection.datasetDraftItems[0]?.input.jobSpec.title).toBe(withRulePackage.jobSpec.title);
    expect(projection.datasetDraftItems[0]?.expected.feedback.issue).toBe("需要补充具体边界");
    expect(projection.needsFromFrameworkWorker).toContain("generic WorkflowRun repository can persist domain string + metadata without business table names");
    expect(projection.needsFromFrameworkWorker).toContain("generic Dataset draft repository can keep human-confirmation status before promotion");
  });

  it("converts Writing dataset drafts into appendable framework dataset items", async () => {
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
    const { run: withRulePackage } = await createRulePackageDraft(finalized.id, {
      candidateId: candidate.id,
    });

    const projection = buildWritingAdapterReadinessProjection(withRulePackage);
    const adapterModule = (await import("@doc-maker/writing-domain/adapter-readiness")) as {
      writingDatasetDraftItemToFrameworkDatasetItem?: (
        item: (typeof projection.datasetDraftItems)[number],
        options: { datasetId: string; at?: string },
      ) => FrameworkDatasetItem;
    };
    const convert = adapterModule.writingDatasetDraftItemToFrameworkDatasetItem;

    expect(convert).toBeTypeOf("function");
    if (typeof convert !== "function") {
      return;
    }

    const datasetId = "writing_readiness_dataset_draft";
    const at = "2026-06-05T00:00:00.000Z";
    const frameworkItem = convert(projection.datasetDraftItems[0], { datasetId, at });
    const typedItem: FrameworkDatasetItem = frameworkItem;

    expect(typedItem).toEqual(
      expect.objectContaining({
        datasetId,
        sourceRunId: withRulePackage.id,
        sourceArtifactId: candidate.id,
        split: "draft",
      }),
    );
    expect(typedItem.inputRef?.materialRefs).toContain(withRulePackage.id);
    expect(typedItem.expectedOutputRef?.materialRefs).toContain(candidate.id);
    expect(typedItem.labels).toEqual(
      expect.objectContaining({
        feedback: expect.objectContaining({
          verdict: "rewrite",
          confidence: "high",
          status: "compiled",
        }),
      }),
    );
    expect(typedItem.metadata).toEqual(
      expect.objectContaining({
        domain: "writing",
        reviewStatus: "needs_human_confirmation",
      }),
    );

    const { createPostgresDatasetRepository } = await import("../../../../packages/framework-store/src/index");
    const client = new FakeDatasetSqlClient();
    const repository = createPostgresDatasetRepository(client);
    const dataset: FrameworkDatasetRecord = {
      id: datasetId,
      kind: "writing_readiness",
      version: "draft",
      items: [],
      createdAt: at,
      updatedAt: at,
      metadata: { domain: "writing" },
    };

    await repository.putDataset(dataset);
    const withItem = await repository.appendDatasetItem(datasetId, frameworkItem);

    expect(withItem.items).toEqual([frameworkItem]);
    expect(client.items.get(datasetId)?.[0]?.metadata_json).toContain("frameworkDatasetItem");
  });
});
