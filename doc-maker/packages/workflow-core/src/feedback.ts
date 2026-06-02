import type { ArtifactRef, WorkflowMetadata } from "@doc-maker/workflow-core/artifact";

export type WorkflowFeedbackStatus = "unprocessed" | "compiled" | "dismissed";

export type WorkflowFeedbackSignal = {
  id: string;
  at: string;
  targetArtifactRef: ArtifactRef;
  status: WorkflowFeedbackStatus;
  verdict?: string;
  quote?: string;
  issue?: string;
  expected?: string;
  confidence?: "low" | "medium" | "high";
  metadata: WorkflowMetadata;
};

export function workflowFeedbackSignal(input: {
  id: string;
  at: string;
  targetArtifactRef: ArtifactRef;
  status?: WorkflowFeedbackStatus;
  verdict?: string;
  quote?: string;
  issue?: string;
  expected?: string;
  confidence?: "low" | "medium" | "high";
  metadata?: WorkflowMetadata;
}): WorkflowFeedbackSignal {
  return {
    id: input.id,
    at: input.at,
    targetArtifactRef: input.targetArtifactRef,
    status: input.status ?? "unprocessed",
    verdict: input.verdict,
    quote: input.quote,
    issue: input.issue,
    expected: input.expected,
    confidence: input.confidence,
    metadata: input.metadata ?? {},
  };
}
