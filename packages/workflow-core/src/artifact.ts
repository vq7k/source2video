export type WorkflowJsonPrimitive = string | number | boolean | null;

export type WorkflowJsonValue =
  | WorkflowJsonPrimitive
  | { [key: string]: WorkflowJsonValue }
  | WorkflowJsonValue[];

export type WorkflowJsonObject = Record<string, WorkflowJsonValue>;

export type WorkflowMetadataValue = WorkflowJsonPrimitive;

export type WorkflowMetadata = Record<string, WorkflowMetadataValue>;

export type ArtifactRef = {
  id: string;
  kind: string;
  version: string;
  uri?: string;
  summary: string;
  materialRefs: string[];
  metadata: WorkflowMetadata;
};

export type ArtifactRecord = ArtifactRef & {
  runId?: string;
  nodeRunId?: string;
  createdAt: string;
  updatedAt: string;
};

export function artifactRef(input: {
  id: string;
  kind: string;
  summary: string;
  version?: string;
  uri?: string;
  materialRefs?: string[];
  metadata?: WorkflowMetadata;
}): ArtifactRef {
  return {
    id: input.id,
    kind: input.kind,
    version: input.version ?? "v0",
    uri: input.uri,
    summary: input.summary,
    materialRefs: input.materialRefs ?? [],
    metadata: input.metadata ?? {},
  };
}
