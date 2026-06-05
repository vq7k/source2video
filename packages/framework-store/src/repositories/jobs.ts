import { randomUUID } from "node:crypto";

import type { WorkflowJsonObject, WorkflowMetadata } from "@source2video/workflow-core/artifact";

import type { FrameworkSqlClient } from "../db";
import type {
  CompleteJobInput,
  EnqueueJobInput,
  FailJobInput,
  FrameworkJobLease,
  FrameworkJobRecord,
  JobRepository,
  LeaseJobInput,
} from "../index";

type JobRow = {
  id: string;
  kind: string;
  status: FrameworkJobRecord["status"];
  run_id?: string | null;
  node_run_id?: string | null;
  priority: number;
  payload_json: unknown;
  result_json?: unknown;
  error_json?: unknown;
  attempts: number;
  max_attempts: number;
  run_after: string | Date;
  locked_by?: string | null;
  locked_at?: string | Date | null;
  lease_id?: string | null;
  leased_until?: string | Date | null;
  completed_at?: string | Date | null;
  failed_at?: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
  metadata_json: unknown;
};

export type JobRepositoryOptions = {
  now?: () => Date;
  createJobId?: () => string;
  createLeaseId?: () => string;
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

function jobError(value: unknown) {
  const parsed = fromJson<{ message?: string } | string | null>(value, null);

  if (!parsed) {
    return undefined;
  }
  if (typeof parsed === "string") {
    return parsed;
  }

  return parsed.message;
}

function jobFromRow(row: JobRow): FrameworkJobRecord {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    runId: row.run_id ?? undefined,
    nodeRunId: row.node_run_id ?? undefined,
    leaseId: row.lease_id ?? undefined,
    workerId: row.locked_by ?? undefined,
    leasedAt: timestamp(row.locked_at),
    leasedUntil: timestamp(row.leased_until),
    completedAt: timestamp(row.completed_at),
    failedAt: timestamp(row.failed_at),
    error: jobError(row.error_json),
    result: fromJson(row.result_json, undefined),
    priority: row.priority,
    payload: fromJson(row.payload_json, {}),
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    availableAt: timestamp(row.run_after) ?? "",
    createdAt: timestamp(row.created_at) ?? "",
    updatedAt: timestamp(row.updated_at) ?? "",
    metadata: fromJson(row.metadata_json, {}),
  };
}

function isoNow(options: Required<Pick<JobRepositoryOptions, "now">>) {
  return options.now().toISOString();
}

export function createPostgresJobRepository(
  client: FrameworkSqlClient,
  options: JobRepositoryOptions = {},
): JobRepository {
  const repositoryOptions = {
    now: options.now ?? (() => new Date()),
    createJobId: options.createJobId ?? randomUUID,
    createLeaseId: options.createLeaseId ?? randomUUID,
  };

  return {
    async enqueueJob(input: EnqueueJobInput) {
      const now = isoNow(repositoryOptions);
      const result = await client.query<JobRow>(
        `
          insert into framework_jobs (
            id,
            kind,
            status,
            run_id,
            node_run_id,
            priority,
            payload_json,
            max_attempts,
            run_after,
            created_at,
            updated_at,
            metadata_json
          )
          values ($1, $2, 'queued', $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11::jsonb)
          on conflict (id) do update set
            kind = excluded.kind,
            status = 'queued',
            run_id = excluded.run_id,
            node_run_id = excluded.node_run_id,
            priority = excluded.priority,
            payload_json = excluded.payload_json,
            max_attempts = excluded.max_attempts,
            run_after = excluded.run_after,
            updated_at = excluded.updated_at,
            metadata_json = excluded.metadata_json
          returning *
        `,
        [
          input.id ?? repositoryOptions.createJobId(),
          input.kind,
          input.runId,
          input.nodeRunId,
          input.priority ?? 100,
          toJson(input.payload ?? {}),
          input.maxAttempts ?? 3,
          input.availableAt ?? now,
          now,
          now,
          toJson(input.metadata ?? {}),
        ],
      );

      return jobFromRow(result.rows[0]);
    },

    async leaseJob(input: LeaseJobInput): Promise<FrameworkJobLease | null> {
      const now = isoNow(repositoryOptions);
      const leasedUntil = new Date(Date.parse(now) + input.leaseDurationMs).toISOString();
      const leaseId = repositoryOptions.createLeaseId();
      const parameters: unknown[] = [input.workerId, leaseId, now, leasedUntil];
      const kindClause = input.kinds?.length ? `and kind = any($5::text[])` : "";

      if (input.kinds?.length) {
        parameters.push(input.kinds);
      }

      const result = await client.query<JobRow>(
        `
          with next_job as (
            select id
            from framework_jobs
            where (
              status = 'queued'
              or (status = 'leased' and leased_until <= $3)
            )
              and run_after <= $3
              and attempts < max_attempts
              ${kindClause}
            order by priority asc, run_after asc, created_at asc, id asc
            for update skip locked
            limit 1
          )
          update framework_jobs
          set
            status = 'leased',
            locked_by = $1,
            locked_at = $3,
            lease_id = $2,
            leased_until = $4,
            attempts = attempts + 1,
            updated_at = $3
          from next_job
          where framework_jobs.id = next_job.id
          returning framework_jobs.*
        `,
        parameters,
      );
      const row = result.rows[0];

      if (!row) {
        return null;
      }

      return {
        job: jobFromRow(row),
        leaseId: row.lease_id ?? leaseId,
        leasedUntil: timestamp(row.leased_until) ?? leasedUntil,
      };
    },

    async completeJob(input: CompleteJobInput) {
      const completedAt = input.completedAt ?? isoNow(repositoryOptions);
      const result = await client.query<JobRow>(
        `
          update framework_jobs
          set
            status = 'complete',
            result_json = $4::jsonb,
            metadata_json = coalesce($5::jsonb, metadata_json),
            completed_at = $3,
            locked_by = null,
            locked_at = null,
            lease_id = null,
            leased_until = null,
            updated_at = $3
          where id = $1
            and lease_id = $2
            and status = 'leased'
          returning *
        `,
        [
          input.jobId,
          input.leaseId,
          completedAt,
          toJson(input.result ?? {}),
          input.metadata ? toJson(input.metadata) : undefined,
        ],
      );
      const row = result.rows[0];

      if (!row) {
        throw new Error(`Leased job not found: ${input.jobId}`);
      }

      return jobFromRow(row);
    },

    async failJob(input: FailJobInput) {
      const failedAt = input.failedAt ?? isoNow(repositoryOptions);
      const retryAt = input.retryAt ?? failedAt;
      const errorJson: WorkflowJsonObject = { message: input.error };
      const metadata: WorkflowMetadata | undefined = input.metadata;
      const result = await client.query<JobRow>(
        `
          update framework_jobs
          set
            status = case
              when attempts < max_attempts then 'queued'
              else 'failed'
            end,
            error_json = $3::jsonb,
            run_after = $4,
            failed_at = case
              when attempts < max_attempts then null
              else $5
            end,
            metadata_json = coalesce($6::jsonb, metadata_json),
            locked_by = null,
            locked_at = null,
            lease_id = null,
            leased_until = null,
            updated_at = $5
          where id = $1
            and lease_id = $2
            and status = 'leased'
          returning *
        `,
        [
          input.jobId,
          input.leaseId,
          toJson(errorJson),
          retryAt,
          failedAt,
          metadata ? toJson(metadata) : undefined,
        ],
      );
      const row = result.rows[0];

      if (!row) {
        throw new Error(`Leased job not found: ${input.jobId}`);
      }

      return jobFromRow(row);
    },
  };
}
