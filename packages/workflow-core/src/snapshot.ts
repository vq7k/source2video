import type { WorkflowMetadata } from "@source2video/workflow-core/artifact";

export type WorkflowSnapshotRef = {
  id: string;
  kind: string;
  version: string;
  status: "active" | "archived";
  sourceRefs: string[];
  summary: string;
  metadata: WorkflowMetadata;
};

export function workflowSnapshotRef(input: {
  id: string;
  kind: string;
  version: string;
  status?: WorkflowSnapshotRef["status"];
  sourceRefs?: string[];
  summary: string;
  metadata?: WorkflowMetadata;
}): WorkflowSnapshotRef {
  return {
    id: input.id,
    kind: input.kind,
    version: input.version,
    status: input.status ?? "active",
    sourceRefs: input.sourceRefs ?? [],
    summary: input.summary,
    metadata: input.metadata ?? {},
  };
}
