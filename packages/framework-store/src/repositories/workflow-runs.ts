import type { NodeRunRecord } from "@source2video/workflow-core/node";
import type { WorkflowRunRecord } from "@source2video/workflow-core/run";

import type { FrameworkSqlClient } from "../db";
import type { WorkflowRunListFilter, WorkflowRunRepository } from "../index";

type WorkflowRunRow = {
  id: string;
  domain: string;
  status: WorkflowRunRecord["status"];
  created_at: string | Date;
  updated_at: string | Date;
  input_artifacts_json: unknown;
  output_artifacts_json: unknown;
  eval_runs_json: unknown;
  feedback_signals_json: unknown;
  snapshots_json: unknown;
  metadata_json: unknown;
};

type NodeRunRow = {
  id: string;
  run_id: string;
  node_id: string;
  node_version: string;
  status: NodeRunRecord["status"];
  input_refs_json: unknown;
  output_refs_json: unknown;
  eval_run_refs_json: unknown;
  trace_refs_json: unknown;
  started_at: string | Date;
  completed_at?: string | Date | null;
  metadata_json: unknown;
};

function toJson(value: unknown) {
  return JSON.stringify(value ?? null);
}

function fromJson<T>(value: unknown, fallback: T): T {
  if (typeof value === "string") {
    return JSON.parse(value) as T;
  }

  return (value ?? fallback) as T;
}

function timestamp(value: string | Date | null | undefined) {
  if (!value) {
    return undefined;
  }

  return value instanceof Date ? value.toISOString() : value;
}

function nodeRunFromRow(row: NodeRunRow): NodeRunRecord {
  return {
    id: row.id,
    nodeId: row.node_id,
    nodeVersion: row.node_version,
    runId: row.run_id,
    status: row.status,
    inputRefs: fromJson(row.input_refs_json, []),
    outputRefs: fromJson(row.output_refs_json, []),
    evalRunRefs: fromJson(row.eval_run_refs_json, []),
    traceRefs: fromJson(row.trace_refs_json, []),
    startedAt: timestamp(row.started_at) ?? "",
    completedAt: timestamp(row.completed_at),
    metadata: fromJson(row.metadata_json, {}),
  };
}

function runFromRow(row: WorkflowRunRow, nodeRuns: NodeRunRecord[]): WorkflowRunRecord {
  return {
    id: row.id,
    domain: row.domain,
    status: row.status,
    createdAt: timestamp(row.created_at) ?? "",
    updatedAt: timestamp(row.updated_at) ?? "",
    inputArtifacts: fromJson(row.input_artifacts_json, []),
    outputArtifacts: fromJson(row.output_artifacts_json, []),
    nodeRuns,
    evalRuns: fromJson(row.eval_runs_json, []),
    feedbackSignals: fromJson(row.feedback_signals_json, []),
    snapshots: fromJson(row.snapshots_json, []),
    metadata: fromJson(row.metadata_json, {}),
  };
}

export function createPostgresWorkflowRunRepository(client: FrameworkSqlClient): WorkflowRunRepository {
  async function listNodeRuns(runId: string) {
    const result = await client.query<NodeRunRow>(
      `
        select *
        from framework_node_runs
        where run_id = $1
        order by started_at asc, id asc
      `,
      [runId],
    );

    return result.rows.map(nodeRunFromRow);
  }

  async function hydrateRun(row: WorkflowRunRow) {
    return runFromRow(row, await listNodeRuns(row.id));
  }

  return {
    async putRun(run) {
      const result = await client.query<WorkflowRunRow>(
        `
          insert into framework_workflow_runs (
            id,
            domain,
            status,
            created_at,
            updated_at,
            input_artifacts_json,
            output_artifacts_json,
            eval_runs_json,
            feedback_signals_json,
            snapshots_json,
            metadata_json
          )
          values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb)
          on conflict (id) do update set
            domain = excluded.domain,
            status = excluded.status,
            updated_at = excluded.updated_at,
            input_artifacts_json = excluded.input_artifacts_json,
            output_artifacts_json = excluded.output_artifacts_json,
            eval_runs_json = excluded.eval_runs_json,
            feedback_signals_json = excluded.feedback_signals_json,
            snapshots_json = excluded.snapshots_json,
            metadata_json = excluded.metadata_json
          returning *
        `,
        [
          run.id,
          run.domain,
          run.status,
          run.createdAt,
          run.updatedAt,
          toJson(run.inputArtifacts),
          toJson(run.outputArtifacts),
          toJson(run.evalRuns),
          toJson(run.feedbackSignals),
          toJson(run.snapshots),
          toJson(run.metadata),
        ],
      );

      return runFromRow(result.rows[0], []);
    },

    async getRun(runId) {
      const result = await client.query<WorkflowRunRow>(
        `
          select *
          from framework_workflow_runs
          where id = $1
        `,
        [runId],
      );
      const row = result.rows[0];

      return row ? hydrateRun(row) : null;
    },

    async listRuns(filter: WorkflowRunListFilter = {}) {
      const parameters: unknown[] = [];
      const clauses: string[] = [];

      if (filter.domain) {
        parameters.push(filter.domain);
        clauses.push(`domain = $${parameters.length}`);
      }
      if (filter.status) {
        parameters.push(filter.status);
        clauses.push(`status = $${parameters.length}`);
      }
      if (filter.updatedAfter) {
        parameters.push(filter.updatedAfter);
        clauses.push(`updated_at > $${parameters.length}`);
      }

      const limit = filter.limit ?? 100;
      parameters.push(limit);
      const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
      const result = await client.query<WorkflowRunRow>(
        `
          select *
          from framework_workflow_runs
          ${where}
          order by updated_at desc, id asc
          limit $${parameters.length}
        `,
        parameters,
      );

      return Promise.all(result.rows.map(hydrateRun));
    },

    async appendNodeRun(runId, nodeRun) {
      await client.query<NodeRunRow>(
        `
          insert into framework_node_runs (
            id,
            run_id,
            node_id,
            node_version,
            status,
            input_refs_json,
            output_refs_json,
            eval_run_refs_json,
            trace_refs_json,
            started_at,
            completed_at,
            metadata_json
          )
          values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10, $11, $12::jsonb)
          on conflict (id) do update set
            status = excluded.status,
            input_refs_json = excluded.input_refs_json,
            output_refs_json = excluded.output_refs_json,
            eval_run_refs_json = excluded.eval_run_refs_json,
            trace_refs_json = excluded.trace_refs_json,
            completed_at = excluded.completed_at,
            metadata_json = excluded.metadata_json
          returning *
        `,
        [
          nodeRun.id,
          runId,
          nodeRun.nodeId,
          nodeRun.nodeVersion,
          nodeRun.status,
          toJson(nodeRun.inputRefs),
          toJson(nodeRun.outputRefs),
          toJson(nodeRun.evalRunRefs),
          toJson(nodeRun.traceRefs),
          nodeRun.startedAt,
          nodeRun.completedAt,
          toJson(nodeRun.metadata),
        ],
      );
      const run = await this.getRun(runId);
      if (!run) {
        throw new Error(`Workflow run not found: ${runId}`);
      }

      return run;
    },

    async appendEvalRun(runId, evalRun) {
      const run = await this.getRun(runId);
      if (!run) {
        throw new Error(`Workflow run not found: ${runId}`);
      }

      return this.putRun({
        ...run,
        evalRuns: [...run.evalRuns, evalRun],
      });
    },

    async appendFeedbackSignal(runId, feedback) {
      const run = await this.getRun(runId);
      if (!run) {
        throw new Error(`Workflow run not found: ${runId}`);
      }

      return this.putRun({
        ...run,
        feedbackSignals: [...run.feedbackSignals, feedback],
      });
    },
  };
}
