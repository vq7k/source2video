import type { LLMCallTraceRecord } from "@source2video/workflow-core/trace";

export type FrameworkLayer = "L1" | "L2" | "L3";

export type FrameworkNodeType = string;

export type FrameworkArtifact = {
  id: string;
  kind: string;
  label: string;
  summary: string;
  ref?: string;
};

export type FrameworkEvalCheck = {
  label: string;
  status: "pass" | "warning" | "blocked";
  evidence: string;
  guidance: string;
};

export type FrameworkEvalRun = {
  id: string;
  kind: string;
  status: "complete";
  score: number | null;
  source: string;
  checks: FrameworkEvalCheck[];
};

export type { LLMCallTraceRecord } from "@source2video/workflow-core/trace";

export type FrameworkNodeRunRecord = {
  id: string;
  nodeId?: string;
  nodeType: FrameworkNodeType;
  layer: FrameworkLayer;
  status: "complete" | "failed" | "skipped";
  startedAt: string;
  completedAt: string;
  inputs: string[];
  artifacts: FrameworkArtifact[];
  evalRuns: FrameworkEvalRun[];
  llmCalls?: LLMCallTraceRecord[];
  trace: string[];
};
