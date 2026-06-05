import type { LLMCallTraceRecord } from "@source2video/workflow-core/trace";
import type { CoreEvalRun } from "@source2video/workflow-core/eval";
import type { WorkflowMetadata } from "@source2video/workflow-core/artifact";

export type WriteEvalScoresInput = {
  runId: string;
  nodeRunId?: string;
  trace: LLMCallTraceRecord;
  evalRun: CoreEvalRun;
  metadata?: WorkflowMetadata;
};

export type WriteFeedbackScoreInput = {
  runId: string;
  nodeRunId?: string;
  trace: LLMCallTraceRecord;
  feedbackId: string;
  targetArtifactId?: string;
  name: string;
  value: number | string | boolean;
  dataType: "NUMERIC" | "CATEGORICAL" | "BOOLEAN";
  comment?: string;
  metadata?: WorkflowMetadata;
};

export type ScoreSinkResult = {
  sink: "local-json" | "langfuse";
  status: "complete" | "skipped" | "failed";
  scoreCount: number;
  error?: string;
};

export type ScoreSink = {
  name: ScoreSinkResult["sink"];
  writeEvalScores(input: WriteEvalScoresInput): Promise<ScoreSinkResult>;
  writeFeedbackScore(input: WriteFeedbackScoreInput): Promise<ScoreSinkResult>;
};
