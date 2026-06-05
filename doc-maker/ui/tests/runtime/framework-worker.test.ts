import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { FrameworkJobRecord } from "../../../../packages/framework-store/src/index";

type QueryResult<T> = {
  rows: T[];
};

type JobRow = {
  id: string;
  kind: string;
  status: FrameworkJobRecord["status"];
  run_id: string | null;
  node_run_id: string | null;
  priority: number;
  payload_json: string;
  result_json: string | null;
  error_json: string | null;
  attempts: number;
  max_attempts: number;
  run_after: string;
  locked_by: string | null;
  locked_at: string | null;
  lease_id: string | null;
  leased_until: string | null;
  completed_at: string | null;
  failed_at: string | null;
  created_at: string;
  updated_at: string;
  metadata_json: string;
};

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, "../../../..");

function readText(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function compactSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim().toLowerCase();
}

class FakeJobSqlClient {
  readonly jobs = new Map<string, JobRow>();
  readonly queries: Array<{ sql: string; parameters: readonly unknown[] }> = [];

  async query<T>(sql: string, parameters: readonly unknown[] = []): Promise<QueryResult<T>> {
    this.queries.push({ sql, parameters });
    const normalized = compactSql(sql);

    if (normalized.includes("insert into framework_jobs")) {
      const row: JobRow = {
        id: parameters[0] as string,
        kind: parameters[1] as string,
        status: "queued",
        run_id: (parameters[2] as string | undefined) ?? null,
        node_run_id: (parameters[3] as string | undefined) ?? null,
        priority: parameters[4] as number,
        payload_json: parameters[5] as string,
        result_json: null,
        error_json: null,
        attempts: 0,
        max_attempts: parameters[6] as number,
        run_after: parameters[7] as string,
        locked_by: null,
        locked_at: null,
        lease_id: null,
        leased_until: null,
        completed_at: null,
        failed_at: null,
        created_at: parameters[8] as string,
        updated_at: parameters[9] as string,
        metadata_json: parameters[10] as string,
      };
      this.jobs.set(row.id, row);
      return { rows: [row as T] };
    }

    if (normalized.includes("for update skip locked") && normalized.includes("update framework_jobs")) {
      const workerId = parameters[0] as string;
      const leaseId = parameters[1] as string;
      const now = parameters[2] as string;
      const leasedUntil = parameters[3] as string;
      const kinds = parameters[4] as string[] | undefined;
      const candidate = Array.from(this.jobs.values())
        .filter((job) => {
          const isQueued = job.status === "queued";
          const isExpiredLease = job.status === "leased" && !!job.leased_until && job.leased_until <= now;
          return (
            (isQueued || isExpiredLease) &&
            job.run_after <= now &&
            job.attempts < job.max_attempts &&
            (!kinds || kinds.includes(job.kind))
          );
        })
        .sort((left, right) => left.priority - right.priority || left.run_after.localeCompare(right.run_after))[0];

      if (!candidate) {
        return { rows: [] };
      }

      candidate.status = "leased";
      candidate.locked_by = workerId;
      candidate.locked_at = now;
      candidate.lease_id = leaseId;
      candidate.leased_until = leasedUntil;
      candidate.attempts += 1;
      candidate.updated_at = now;

      return { rows: [candidate as T] };
    }

    if (normalized.includes("status = 'complete'")) {
      const jobId = parameters[0] as string;
      const leaseId = parameters[1] as string;
      const completedAt = parameters[2] as string;
      const resultJson = parameters[3] as string;
      const metadataJson = parameters[4] as string | undefined;
      const job = this.jobs.get(jobId);
      if (!job || job.lease_id !== leaseId || job.status !== "leased") {
        return { rows: [] };
      }

      job.status = "complete";
      job.result_json = resultJson;
      job.metadata_json = metadataJson ?? job.metadata_json;
      job.completed_at = completedAt;
      job.locked_by = null;
      job.locked_at = null;
      job.lease_id = null;
      job.leased_until = null;
      job.updated_at = completedAt;

      return { rows: [job as T] };
    }

    if (normalized.includes("error_json")) {
      const jobId = parameters[0] as string;
      const leaseId = parameters[1] as string;
      const errorJson = parameters[2] as string;
      const retryAt = parameters[3] as string;
      const failedAt = parameters[4] as string;
      const metadataJson = parameters[5] as string | undefined;
      const job = this.jobs.get(jobId);
      if (!job || job.lease_id !== leaseId || job.status !== "leased") {
        return { rows: [] };
      }

      const shouldRetry = job.attempts < job.max_attempts;
      job.status = shouldRetry ? "queued" : "failed";
      job.error_json = errorJson;
      job.metadata_json = metadataJson ?? job.metadata_json;
      job.run_after = retryAt;
      job.failed_at = shouldRetry ? null : failedAt;
      job.locked_by = null;
      job.locked_at = null;
      job.lease_id = null;
      job.leased_until = null;
      job.updated_at = failedAt;

      return { rows: [job as T] };
    }

    throw new Error(`Unhandled SQL in fake client: ${normalized}`);
  }
}

describe("framework worker runtime", () => {
  it("exports generic runtime files and a UI worker script", () => {
    const packageJson = JSON.parse(readText("doc-maker/ui/package.json")) as {
      scripts: Record<string, string>;
    };

    expect(fs.existsSync(path.join(repoRoot, "packages/framework-runtime/src/jobs.ts"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, "packages/framework-runtime/src/worker.ts"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, "packages/framework-runtime/src/handlers.ts"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, "doc-maker/ui/scripts/run-framework-worker.mjs"))).toBe(true);
    expect(packageJson.scripts["framework:worker"]).toBe("node scripts/run-framework-worker.mjs");
  });

  it("leases a queued job once and never leases completed jobs", async () => {
    const { createPostgresJobRepository } = await import(
      "../../../../packages/framework-store/src/repositories/jobs"
    );
    let now = new Date("2026-06-05T00:00:00.000Z");
    let leaseCounter = 0;
    const client = new FakeJobSqlClient();
    const repository = createPostgresJobRepository(client, {
      now: () => now,
      createLeaseId: () => `lease_${++leaseCounter}`,
    });

    await repository.enqueueJob({ id: "job_once", kind: "generic.echo", payload: { message: "hello" } });
    const lease = await repository.leaseJob({ workerId: "worker_a", leaseDurationMs: 60_000 });
    const secondLease = await repository.leaseJob({ workerId: "worker_b", leaseDurationMs: 60_000 });

    expect(lease?.job.id).toBe("job_once");
    expect(lease?.job.workerId).toBe("worker_a");
    expect(lease?.job.attempts).toBe(1);
    expect(secondLease).toBeNull();

    await repository.completeJob({ jobId: "job_once", leaseId: lease?.leaseId ?? "", metadata: { done: true } });
    now = new Date("2026-06-05T00:02:00.000Z");

    await expect(repository.leaseJob({ workerId: "worker_c", leaseDurationMs: 60_000 })).resolves.toBeNull();
    expect(client.queries.some((query) => compactSql(query.sql).includes("for update skip locked"))).toBe(true);
    expect(client.queries.every((query) => Array.isArray(query.parameters))).toBe(true);
    expect(client.queries.some((query) => query.parameters.length > 0)).toBe(true);
  });

  it("releases expired locks and retries failed jobs until max attempts", async () => {
    const { createPostgresJobRepository } = await import(
      "../../../../packages/framework-store/src/repositories/jobs"
    );
    let now = new Date("2026-06-05T00:00:00.000Z");
    let leaseCounter = 0;
    const client = new FakeJobSqlClient();
    const repository = createPostgresJobRepository(client, {
      now: () => now,
      createLeaseId: () => `lease_${++leaseCounter}`,
    });

    await repository.enqueueJob({ id: "job_expired", kind: "generic.expired", maxAttempts: 2 });
    const firstExpiredLease = await repository.leaseJob({ workerId: "worker_a", leaseDurationMs: 1_000 });
    now = new Date("2026-06-05T00:00:02.000Z");
    const secondExpiredLease = await repository.leaseJob({ workerId: "worker_b", leaseDurationMs: 1_000 });

    expect(firstExpiredLease?.job.workerId).toBe("worker_a");
    expect(secondExpiredLease?.job.workerId).toBe("worker_b");
    expect(secondExpiredLease?.job.attempts).toBe(2);

    await repository.enqueueJob({ id: "job_retry", kind: "generic.retry", maxAttempts: 2 });
    const firstRetryLease = await repository.leaseJob({ workerId: "worker_retry", leaseDurationMs: 1_000 });
    const retry = await repository.failJob({
      jobId: "job_retry",
      leaseId: firstRetryLease?.leaseId ?? "",
      error: "first failure",
      retryAt: "2026-06-05T00:00:03.000Z",
    });
    now = new Date("2026-06-05T00:00:03.000Z");
    const secondRetryLease = await repository.leaseJob({ workerId: "worker_retry", leaseDurationMs: 1_000 });
    const terminal = await repository.failJob({
      jobId: "job_retry",
      leaseId: secondRetryLease?.leaseId ?? "",
      error: "second failure",
    });

    expect(retry.status).toBe("queued");
    expect(secondRetryLease?.job.attempts).toBe(2);
    expect(terminal.status).toBe("failed");
    await expect(repository.leaseJob({ workerId: "worker_retry", leaseDurationMs: 1_000 })).resolves.toBeNull();
  });

  it("runs one registered handler per worker once call", async () => {
    const { createPostgresJobRepository } = await import(
      "../../../../packages/framework-store/src/repositories/jobs"
    );
    const { createHandlerRegistry } = await import("../../../../packages/framework-runtime/src/handlers");
    const { createFrameworkWorker } = await import("../../../../packages/framework-runtime/src/worker");
    const client = new FakeJobSqlClient();
    const repository = createPostgresJobRepository(client, {
      now: () => new Date("2026-06-05T00:00:00.000Z"),
      createLeaseId: () => "lease_once",
    });
    const handlers = createHandlerRegistry();
    const handled: string[] = [];

    handlers.register("generic.echo", async (job: FrameworkJobRecord) => {
      handled.push(job.id);
      return { ok: true, message: job.payload.message };
    });
    await repository.enqueueJob({ id: "job_1", kind: "generic.echo", payload: { message: "one" } });
    await repository.enqueueJob({ id: "job_2", kind: "generic.echo", payload: { message: "two" } });

    const worker = createFrameworkWorker({
      workerId: "worker_once",
      jobs: repository,
      handlers,
      leaseDurationMs: 60_000,
    });
    const result = await worker.once();

    expect(result.status).toBe("completed");
    expect(handled).toEqual(["job_1"]);
    expect(client.jobs.get("job_1")?.status).toBe("complete");
    expect(client.jobs.get("job_2")?.status).toBe("queued");
  });
});
