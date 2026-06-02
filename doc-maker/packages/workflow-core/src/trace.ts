import type { WorkflowMetadata } from "@doc-maker/workflow-core/artifact";

export type TraceArtifact = {
  id: string;
  kind: string;
  label: string;
  summary: string;
  ref?: string;
};

export type LLMCallTraceRecord = {
  id: string;
  at: string;
  status: "complete" | "failed";
  sink: "local-json" | "langfuse";
  provider: string;
  model: string;
  promptVersion: string;
  runId?: string;
  nodeRunId?: string;
  nodeType: string;
  inputRefs: string[];
  inputPayload?: unknown;
  outputArtifact: TraceArtifact;
  outputPayload?: unknown;
  evalResult?: {
    id: string;
    kind: string;
    status: "complete" | "skipped";
    score: number | null;
  };
  latencyMs?: number;
  upstreamTraceId?: string;
  langfuseTraceId?: string;
  langfuseObservationId?: string;
  metadata?: WorkflowMetadata;
};

export type CreateLLMCallTraceInput = {
  status?: LLMCallTraceRecord["status"];
  provider: string;
  model: string;
  promptVersion: string;
  nodeType: string;
  inputRefs: string[];
  inputPayload?: unknown;
  outputArtifact: TraceArtifact;
  outputPayload?: unknown;
  runId?: string;
  nodeRunId?: string;
  evalResult?: LLMCallTraceRecord["evalResult"];
  latencyMs?: number;
  upstreamTraceId?: string;
  metadata?: WorkflowMetadata;
};

export type TraceSink = {
  name: LLMCallTraceRecord["sink"];
  captureLLMCall(input: CreateLLMCallTraceInput): Promise<LLMCallTraceRecord>;
};
