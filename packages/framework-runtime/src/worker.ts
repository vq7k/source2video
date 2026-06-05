import type { WorkflowJsonObject } from "@source2video/workflow-core/artifact";

import type { FrameworkHandlerRegistry } from "./handlers";
import type { FrameworkWorkerOnceResult, JobRepository } from "./jobs";

export type FrameworkWorkerOptions = {
  workerId: string;
  jobs: JobRepository;
  handlers: FrameworkHandlerRegistry;
  leaseDurationMs?: number;
};

export type FrameworkWorker = {
  once(): Promise<FrameworkWorkerOnceResult>;
};

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}

export function createFrameworkWorker(options: FrameworkWorkerOptions): FrameworkWorker {
  const leaseDurationMs = options.leaseDurationMs ?? 60_000;

  return {
    async once() {
      const lease = await options.jobs.leaseJob({
        workerId: options.workerId,
        leaseDurationMs,
      });

      if (!lease) {
        return { status: "idle" };
      }

      const handler = options.handlers.get(lease.job.kind);

      if (!handler) {
        const error = new Error(`No handler registered for job kind: ${lease.job.kind}`);
        const failed = await options.jobs.failJob({
          jobId: lease.job.id,
          leaseId: lease.leaseId,
          error: error.message,
        });

        return { status: "failed", job: failed, error };
      }

      try {
        const result = await handler(lease.job, { workerId: options.workerId });
        const completed = await options.jobs.completeJob({
          jobId: lease.job.id,
          leaseId: lease.leaseId,
          result: (result ?? {}) as WorkflowJsonObject,
        });

        return { status: "completed", job: completed };
      } catch (rawError) {
        const error = toError(rawError);
        const failed = await options.jobs.failJob({
          jobId: lease.job.id,
          leaseId: lease.leaseId,
          error: error.message,
        });

        return { status: "failed", job: failed, error };
      }
    },
  };
}
