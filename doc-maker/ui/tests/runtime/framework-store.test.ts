import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type {
  FrameworkDatasetItem,
  FrameworkDatasetRecord,
  FrameworkJobLease,
  FrameworkJobRecord,
  FrameworkStore,
} from "../../../../packages/framework-store/src/index";
import type { ArtifactRecord } from "@source2video/workflow-core/artifact";
import type { CoreEvalRunRecord } from "@source2video/workflow-core/eval";
import type { WorkflowFeedbackSignalRecord } from "@source2video/workflow-core/feedback";
import type { NodeRunRecord } from "@source2video/workflow-core/node";
import type { WorkflowRunRecord } from "@source2video/workflow-core/run";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, "../../../..");
const coreMigrationPath = "packages/framework-store/migrations/0001_framework_core.sql";

function readText(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function frameworkStoreSource(): string {
  return readText("packages/framework-store/src/index.ts");
}

function compactSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim().toLowerCase();
}

describe("framework store contracts", () => {
  it("exports generic repository contracts and method names", () => {
    const source = frameworkStoreSource();
    const requiredExports = [
      "FrameworkStore",
      "WorkflowRunRepository",
      "ArtifactRepository",
      "JobRepository",
      "DatasetRepository",
    ];
    const requiredMethods = [
      "putRun",
      "getRun",
      "listRuns",
      "appendNodeRun",
      "putArtifact",
      "enqueueJob",
      "leaseJob",
      "completeJob",
      "failJob",
    ];

    for (const exportName of requiredExports) {
      expect(source, exportName).toMatch(new RegExp(`export type ${exportName}\\b`));
    }

    for (const methodName of requiredMethods) {
      expect(source, methodName).toMatch(new RegExp(`\\b${methodName}\\b`));
    }
  });

  it("keeps framework store and workflow core source free of business-domain names", () => {
    const frameworkFiles = [
      ...fs.globSync("packages/framework-store/**/*.ts", { cwd: repoRoot }),
      ...fs.globSync("packages/workflow-core/**/*.ts", { cwd: repoRoot }),
    ];
    const businessNames = frameworkFiles.flatMap((relativePath) => {
      const matches = readText(relativePath).match(/writing_|doc-maker|docMaker|Writing/g) ?? [];
      return matches.map((match) => `${relativePath}: ${match}`);
    });

    expect(businessNames).toEqual([]);
  });

  it("allows repository implementations to satisfy the generic store contract", async () => {
    const at = "2026-06-05T00:00:00.000Z";
    const artifact: ArtifactRecord = {
      id: "artifact_1",
      kind: "text",
      version: "v1",
      summary: "Generic artifact",
      materialRefs: [],
      metadata: {},
      createdAt: at,
      updatedAt: at,
    };
    const nodeRun: NodeRunRecord = {
      id: "node_run_1",
      nodeId: "node_1",
      nodeVersion: "v1",
      runId: "run_1",
      status: "complete",
      inputRefs: [],
      outputRefs: [artifact],
      evalRunRefs: [],
      traceRefs: [],
      startedAt: at,
      completedAt: at,
      metadata: {},
    };
    const evalRun: CoreEvalRunRecord = {
      id: "eval_1",
      kind: "quality_gate",
      status: "complete",
      profileVersion: "v1",
      profileSource: "contract_test",
      riskSummary: "none",
      candidateResults: [],
      runId: "run_1",
      nodeRunId: nodeRun.id,
      createdAt: at,
      metadata: {},
    };
    const feedback: WorkflowFeedbackSignalRecord = {
      id: "feedback_1",
      at,
      targetArtifactRef: artifact,
      status: "unprocessed",
      metadata: {},
      runId: "run_1",
      createdAt: at,
      updatedAt: at,
    };
    const run: WorkflowRunRecord = {
      id: "run_1",
      domain: "generic",
      status: "running",
      createdAt: at,
      updatedAt: at,
      inputArtifacts: [],
      outputArtifacts: [artifact],
      nodeRuns: [nodeRun],
      evalRuns: [evalRun],
      feedbackSignals: [feedback],
      snapshots: [],
      metadata: {},
    };
    const job: FrameworkJobRecord = {
      id: "job_1",
      kind: "node_execution",
      status: "queued",
      runId: run.id,
      priority: 0,
      payload: { nodeRunId: nodeRun.id },
      attempts: 0,
      maxAttempts: 3,
      availableAt: at,
      createdAt: at,
      updatedAt: at,
      metadata: {},
    };
    const lease: FrameworkJobLease = {
      job: { ...job, status: "leased", leaseId: "lease_1", leasedAt: at, leasedUntil: at },
      leaseId: "lease_1",
      leasedUntil: at,
    };
    const datasetItem: FrameworkDatasetItem = {
      id: "dataset_item_1",
      datasetId: "dataset_1",
      inputArtifacts: [artifact],
      expectedArtifacts: [],
      metadata: {},
    };
    const dataset: FrameworkDatasetRecord = {
      id: "dataset_1",
      kind: "regression",
      version: "v1",
      items: [datasetItem],
      createdAt: at,
      updatedAt: at,
      metadata: {},
    };
    const store: FrameworkStore = {
      workflowRuns: {
        putRun: async (input) => input,
        getRun: async () => run,
        listRuns: async () => [run],
        appendNodeRun: async () => run,
        appendEvalRun: async () => run,
        appendFeedbackSignal: async () => run,
      },
      artifacts: {
        putArtifact: async (input) => input,
        getArtifact: async () => artifact,
        listArtifacts: async () => [artifact],
      },
      jobs: {
        enqueueJob: async () => job,
        leaseJob: async () => lease,
        completeJob: async () => ({ ...job, status: "complete", completedAt: at }),
        failJob: async () => ({ ...job, status: "failed", failedAt: at, error: "failed" }),
      },
      datasets: {
        putDataset: async (input) => input,
        getDataset: async () => dataset,
        listDatasets: async () => [dataset],
        appendDatasetItem: async () => dataset,
      },
    };

    await expect(store.workflowRuns.getRun(run.id)).resolves.toEqual(run);
    await expect(store.artifacts.getArtifact(artifact.id)).resolves.toEqual(artifact);
    await expect(store.jobs.leaseJob({ workerId: "worker_1", leaseDurationMs: 60_000 })).resolves.toEqual(lease);
    await expect(store.datasets.getDataset(dataset.id)).resolves.toEqual(dataset);
  });

  it("defines the generic Postgres schema migration", () => {
    expect(fs.existsSync(path.join(repoRoot, coreMigrationPath))).toBe(true);

    const sql = compactSql(readText(coreMigrationPath));
    const requiredTables = [
      "framework_workflow_runs",
      "framework_node_runs",
      "framework_artifacts",
      "framework_feedback_events",
      "framework_jobs",
      "framework_datasets",
      "framework_dataset_items",
      "framework_experiments",
      "framework_release_gates",
      "framework_schema_migrations",
    ];

    for (const tableName of requiredTables) {
      expect(sql, tableName).toContain(`create table if not exists ${tableName}`);
    }

    expect(sql).toContain("metadata_json jsonb not null default '{}'::jsonb");
    expect(sql).toContain("payload_json jsonb not null");
    expect(sql).toContain("create index if not exists framework_workflow_runs_domain_updated_at_idx");
    expect(sql).toContain("create index if not exists framework_jobs_status_priority_run_after_idx");
    expect(sql).toContain("references framework_workflow_runs(id)");
    expect(sql).toContain("references framework_datasets(id)");
    expect(sql).not.toMatch(/writing_|doc-maker|docmaker|writing/);
  });

  it("exports migration helpers and exposes a UI migration script", () => {
    const source = readText("packages/framework-store/src/migrations.ts");
    const packageJson = JSON.parse(readText("doc-maker/ui/package.json")) as {
      scripts: Record<string, string>;
    };

    expect(source).toMatch(/\bframeworkMigrations\b/);
    expect(source).toMatch(/\brunFrameworkStoreMigrations\b/);
    expect(fs.existsSync(path.join(repoRoot, "doc-maker/ui/scripts/migrate-framework-store.mjs"))).toBe(true);
    expect(packageJson.scripts["framework:migrate"]).toBe("node scripts/migrate-framework-store.mjs");
  });
});
