import { randomUUID } from "node:crypto";

import { captureLangfuseLLMCall, getLangfuseSettings } from "@/lib/observability/langfuse";
import type { LLMCallTraceRecord } from "@/lib/workflow-core/trace";
import { createNodeRunId } from "@/lib/workflow-core/node";
import type { CreateLLMCallTraceInput, TraceSink } from "@/lib/workflow-core/trace";

export type { CreateLLMCallTraceInput, TraceSink } from "@/lib/workflow-core/trace";

function now() {
  return new Date().toISOString();
}

export const localJsonTraceSink: TraceSink = {
  name: "local-json",

  async captureLLMCall(input) {
    const localTraceId = `llm_trace_${randomUUID().slice(0, 8)}`;

    return {
      id: localTraceId,
      at: now(),
      status: input.status ?? "complete",
      sink: this.name,
      ...input,
      nodeRunId: input.nodeRunId ?? createNodeRunId(),
    };
  },
};

export const langfuseTraceSink: TraceSink = {
  name: "langfuse",

  async captureLLMCall(input) {
    const localTraceId = `llm_trace_${randomUUID().slice(0, 8)}`;
    const nodeRunId = input.nodeRunId ?? createNodeRunId();
    const langfuse = await captureLangfuseLLMCall({
      ...input,
      nodeRunId,
      localTraceId,
    });

    return {
      id: localTraceId,
      at: now(),
      status: input.status ?? "complete",
      sink: this.name,
      ...input,
      nodeRunId,
      langfuseTraceId: langfuse.traceId,
      langfuseObservationId: langfuse.observationId,
    };
  },
};

export const compositeTraceSink: TraceSink = {
  name: "langfuse",

  async captureLLMCall(input) {
    if (!getLangfuseSettings().configured) {
      return localJsonTraceSink.captureLLMCall(input);
    }

    try {
      return await langfuseTraceSink.captureLLMCall(input);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Langfuse capture failed";
      const local = await localJsonTraceSink.captureLLMCall(input);

      return {
        ...local,
        metadata: {
          ...(local.metadata ?? {}),
          langfuse_error: message,
        },
      };
    }
  },
};

export function getTraceSink(): TraceSink {
  return compositeTraceSink;
}

export function bindTraceToRun(trace: LLMCallTraceRecord, runId: string): LLMCallTraceRecord {
  return {
    ...trace,
    runId,
  };
}
