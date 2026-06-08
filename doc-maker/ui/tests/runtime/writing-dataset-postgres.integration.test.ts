import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import fixture from "../fixtures/l1-writing-regression.json";
import {
  promoteWritingDatasetDraftsForRun,
  persistWritingDatasetDraftsForRun,
  WRITING_DATASET_DRAFT_ID,
  WRITING_EVAL_DATASET_ID,
} from "@doc-maker/writing-domain/dataset-draft-persistence";
import {
  compileRulePatch,
  confirmWritingRunPrecheck,
  createRulePackageDraft,
  createWritingRun,
  finalizeWritingRun,
  recordHumanFeedback,
} from "@doc-maker/writing-domain/runtime";
import type { CreateWritingRunInput, WritingRunRecord } from "@doc-maker/writing-domain/types";
import { createPgSqlClient, createPostgresDatasetRepository } from "@source2video/framework-store";
import type { PgSqlClient } from "@source2video/framework-store";

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

type DatasetRow = {
  id: string;
  kind: string;
  version: string;
};

type DatasetItemRow = {
  id: string;
  dataset_id: string;
  review_status: string | null;
  source_draft_item_id: string | null;
};

const shouldRunPostgresIntegration =
  process.env.RUN_POSTGRES_INTEGRATION === "1" && Boolean(process.env.FRAMEWORK_DATABASE_URL);

const describePostgres = shouldRunPostgresIntegration ? describe : describe.skip;

describePostgres("writing dataset Postgres integration", () => {
  let storeDir: string;
  let client: PgSqlClient;

  beforeAll(async () => {
    storeDir = await mkdtemp(path.join(os.tmpdir(), "doc-maker-dataset-postgres-"));
    process.env.DOC_MAKER_RUN_STORE_DIR = storeDir;
    process.env.DOC_MAKER_LLM_PROVIDER = "mock";
    client = createPgSqlClient({ connectionString: process.env.FRAMEWORK_DATABASE_URL! });
    await client.query(
      `
        delete from framework_dataset_items
        where dataset_id in ($1, $2)
      `,
      [WRITING_DATASET_DRAFT_ID, WRITING_EVAL_DATASET_ID],
    );
    await client.query(
      `
        delete from framework_datasets
        where id in ($1, $2)
      `,
      [WRITING_DATASET_DRAFT_ID, WRITING_EVAL_DATASET_ID],
    );
  });

  afterAll(async () => {
    await client?.close();
    delete process.env.DOC_MAKER_RUN_STORE_DIR;
    delete process.env.DOC_MAKER_LLM_PROVIDER;
    await rm(storeDir, { recursive: true, force: true });
  });

  it("persists draft feedback and promotes confirmed eval items through the real framework Postgres repository", async () => {
    const run = await createRunWithDatasetDraft();
    const repository = createPostgresDatasetRepository(client);

    const draftResult = await persistWritingDatasetDraftsForRun(run, repository, {
      at: "2026-06-08T00:00:00.000Z",
    });
    const promotedResult = await promoteWritingDatasetDraftsForRun(run, repository, {
      confirmedBy: "postgres-integration-reviewer",
      at: "2026-06-08T00:00:01.000Z",
      note: "real pg verification",
    });

    const datasets = await client.query<DatasetRow>(
      `
        select id, kind, version
        from framework_datasets
        where id in ($1, $2)
        order by id
      `,
      [WRITING_DATASET_DRAFT_ID, WRITING_EVAL_DATASET_ID],
    );
    const items = await client.query<DatasetItemRow>(
      `
        select
          id,
          dataset_id,
          metadata_json->>'reviewStatus' as review_status,
          metadata_json->>'sourceDraftItemId' as source_draft_item_id
        from framework_dataset_items
        where dataset_id in ($1, $2)
        order by dataset_id, id
      `,
      [WRITING_DATASET_DRAFT_ID, WRITING_EVAL_DATASET_ID],
    );

    expect(draftResult.items).toHaveLength(1);
    expect(promotedResult.items).toHaveLength(1);
    expect(datasets.rows).toEqual([
      { id: WRITING_DATASET_DRAFT_ID, kind: "writing_dataset_draft", version: "draft" },
      { id: WRITING_EVAL_DATASET_ID, kind: "writing_eval_dataset", version: "eval-v1" },
    ]);
    expect(items.rows).toEqual([
      expect.objectContaining({
        dataset_id: WRITING_DATASET_DRAFT_ID,
        review_status: "needs_human_confirmation",
        source_draft_item_id: draftResult.items[0]?.id,
      }),
      expect.objectContaining({
        dataset_id: WRITING_EVAL_DATASET_ID,
        review_status: "human_confirmed",
        source_draft_item_id: draftResult.items[0]?.id,
      }),
    ]);
  });
});
