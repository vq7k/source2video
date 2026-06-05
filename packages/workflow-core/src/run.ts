import type { ArtifactRef, WorkflowMetadata } from "@source2video/workflow-core/artifact";
import type { CoreEvalRun } from "@source2video/workflow-core/eval";
import type { WorkflowFeedbackSignal } from "@source2video/workflow-core/feedback";
import type { NodeRunRecord } from "@source2video/workflow-core/node";
import type { WorkflowSnapshotRef } from "@source2video/workflow-core/snapshot";

export type WorkflowRunStatus = "draft" | "running" | "ready" | "feedback" | "finalized" | "failed";

export type WorkflowRunRecord = {
  id: string;
  domain: string;
  status: WorkflowRunStatus;
  createdAt: string;
  updatedAt: string;
  inputArtifacts: ArtifactRef[];
  outputArtifacts: ArtifactRef[];
  nodeRuns: NodeRunRecord[];
  evalRuns: CoreEvalRun[];
  feedbackSignals: WorkflowFeedbackSignal[];
  snapshots: WorkflowSnapshotRef[];
  metadata: WorkflowMetadata;
};

export function workflowRunRecord(input: {
  id: string;
  domain: string;
  status?: WorkflowRunStatus;
  createdAt: string;
  updatedAt: string;
  inputArtifacts?: ArtifactRef[];
  outputArtifacts?: ArtifactRef[];
  nodeRuns?: NodeRunRecord[];
  evalRuns?: CoreEvalRun[];
  feedbackSignals?: WorkflowFeedbackSignal[];
  snapshots?: WorkflowSnapshotRef[];
  metadata?: WorkflowMetadata;
}): WorkflowRunRecord {
  return {
    id: input.id,
    domain: input.domain,
    status: input.status ?? "ready",
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    inputArtifacts: input.inputArtifacts ?? [],
    outputArtifacts: input.outputArtifacts ?? [],
    nodeRuns: input.nodeRuns ?? [],
    evalRuns: input.evalRuns ?? [],
    feedbackSignals: input.feedbackSignals ?? [],
    snapshots: input.snapshots ?? [],
    metadata: input.metadata ?? {},
  };
}
