export type WorkflowMetadataValue = string | number | boolean | null;

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
