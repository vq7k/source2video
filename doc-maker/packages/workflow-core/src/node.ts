import { randomUUID } from "node:crypto";

import type { ArtifactRef, WorkflowMetadata } from "@doc-maker/workflow-core/artifact";
import type { CoreEvalRun } from "@doc-maker/workflow-core/eval";

export type WorkflowNodeId = string;

export type WorkflowNodeStatus = "complete" | "failed" | "skipped";

export type SchemaRef = {
  id: string;
  version: string;
};

export type NodeRunContext = {
  runId: string;
  nodeRunId: string;
  metadata: WorkflowMetadata;
};

export type NodeSpec<TInput, TOutput> = {
  id: WorkflowNodeId;
  version: string;
  inputSchema: SchemaRef;
  outputSchema: SchemaRef;
  run(input: TInput, ctx: NodeRunContext): Promise<TOutput>;
  eval?: (output: TOutput, ctx: NodeRunContext) => Promise<CoreEvalRun>;
};

export type TraceRef = {
  id: string;
  sink: string;
  traceId?: string;
  observationId?: string;
};

export type NodeRunRecord = {
  id: string;
  nodeId: WorkflowNodeId;
  nodeVersion: string;
  runId: string;
  status: WorkflowNodeStatus;
  inputRefs: ArtifactRef[];
  outputRefs: ArtifactRef[];
  evalRunRefs: string[];
  traceRefs: TraceRef[];
  startedAt: string;
  completedAt?: string;
  metadata: WorkflowMetadata;
};

export function createNodeRunId() {
  return `node_run_${randomUUID().slice(0, 8)}`;
}

export function createNodeRunRecord(input: {
  id?: string;
  nodeId: WorkflowNodeId;
  nodeVersion?: string;
  runId: string;
  status?: WorkflowNodeStatus;
  inputRefs?: ArtifactRef[];
  outputRefs?: ArtifactRef[];
  evalRunRefs?: string[];
  traceRefs?: TraceRef[];
  startedAt?: string;
  completedAt?: string;
  metadata?: WorkflowMetadata;
}): NodeRunRecord {
  const startedAt = input.startedAt ?? new Date().toISOString();

  return {
    id: input.id ?? createNodeRunId(),
    nodeId: input.nodeId,
    nodeVersion: input.nodeVersion ?? "v0",
    runId: input.runId,
    status: input.status ?? "complete",
    inputRefs: input.inputRefs ?? [],
    outputRefs: input.outputRefs ?? [],
    evalRunRefs: input.evalRunRefs ?? [],
    traceRefs: input.traceRefs ?? [],
    startedAt,
    completedAt: input.completedAt ?? startedAt,
    metadata: input.metadata ?? {},
  };
}
