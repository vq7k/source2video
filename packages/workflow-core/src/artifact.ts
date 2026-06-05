export type WorkflowJsonPrimitive = string | number | boolean | null;

export type WorkflowJsonValue =
  | WorkflowJsonPrimitive
  | { [key: string]: WorkflowJsonValue }
  | WorkflowJsonValue[];

export type WorkflowJsonObject = Record<string, WorkflowJsonValue>;

export type WorkflowMetadataValue = WorkflowJsonValue;

export type WorkflowMetadata = WorkflowJsonObject;

export type ArtifactPayloadInput =
  | {
      contentType: string;
      value: string;
      encoding?: "utf8" | "base64";
    }
  | {
      contentType: string;
      bytes: Uint8Array;
    };

export type ArtifactPayloadMetadata = {
  contentType: string;
  contentHash: string;
  byteLength: number;
  uri?: string;
  inlineValue?: WorkflowJsonValue;
};

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
  payload?: ArtifactPayloadInput;
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
