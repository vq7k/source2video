import { createHash, randomUUID } from "node:crypto";

import type { LLMCallTraceRecord } from "@doc-maker/workflow-core/trace";
import type { CoreEvalRun } from "@doc-maker/workflow-core/eval";
import type { CreateLLMCallTraceInput } from "@doc-maker/workflow-core/trace";
import type { WorkflowMetadata } from "@doc-maker/workflow-core/artifact";

type LangfuseSettings = {
  configured: boolean;
  host: string;
  publicKey: string;
  secretKey: string;
  environment: string;
  projectId: string;
};

type LangfuseIngestionEvent = {
  id: string;
  timestamp: string;
  type: "trace-create" | "generation-create" | "score-create";
  body: Record<string, unknown>;
};

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

export function getLangfuseSettings(): LangfuseSettings {
  const host = env("LANGFUSE_HOST") || env("LANGFUSE_BASE_URL") || "https://cloud.langfuse.com";
  const publicKey = env("LANGFUSE_PUBLIC_KEY");
  const secretKey = env("LANGFUSE_SECRET_KEY");

  return {
    configured: Boolean(publicKey && secretKey),
    host: host.replace(/\/$/, ""),
    publicKey,
    secretKey,
    environment: env("LANGFUSE_ENVIRONMENT") || "development",
    projectId: env("LANGFUSE_PROJECT_ID"),
  };
}

export function langfuseTraceUrl(traceId?: string) {
  if (!traceId) {
    return undefined;
  }

  const settings = getLangfuseSettings();
  if (!settings.projectId) {
    return undefined;
  }

  return `${settings.host}/project/${settings.projectId}/traces/${traceId}`;
}

function authHeader(settings: LangfuseSettings) {
  return `Basic ${Buffer.from(`${settings.publicKey}:${settings.secretKey}`).toString("base64")}`;
}

function eventId(prefix: string) {
  return randomUUID();
}

function safeMetadata(metadata?: WorkflowMetadata) {
  return metadata ?? {};
}

function langfuseInput(input: CreateLLMCallTraceInput) {
  return input.inputPayload ?? { refs: input.inputRefs };
}

function langfuseOutput(input: CreateLLMCallTraceInput) {
  return input.outputPayload ?? {
    artifact: input.outputArtifact,
  };
}

function stableUuid(input: string) {
  const hex = createHash("sha256").update(input).digest("hex").slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const value = hex.join("");

  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20, 32)}`;
}

async function postIngestion(batch: LangfuseIngestionEvent[]) {
  const settings = getLangfuseSettings();

  if (!settings.configured) {
    throw new Error("Langfuse env missing: LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY");
  }

  const response = await fetch(`${settings.host}/api/public/ingestion`, {
    method: "POST",
    headers: {
      "Authorization": authHeader(settings),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      batch,
      metadata: {
        client: "doc-maker-ui",
        mode: "workflow-core",
      },
    }),
  });

  if (!response.ok && response.status !== 207) {
    throw new Error(`Langfuse ingestion failed: HTTP ${response.status}`);
  }

  const payload = await response.json().catch(() => null) as { errors?: unknown[] } | null;
  if (payload?.errors?.length) {
    throw new Error(`Langfuse ingestion errors: ${JSON.stringify(payload.errors)}`);
  }
}

export async function captureLangfuseLLMCall(input: CreateLLMCallTraceInput & { localTraceId: string }) {
  const settings = getLangfuseSettings();
  const at = new Date().toISOString();
  const traceId = stableUuid(input.runId ?? input.localTraceId);
  const observationId = stableUuid(`${traceId}:${input.nodeRunId ?? input.localTraceId}`);
  const statusMessage = input.status === "failed" ? input.outputArtifact.summary : undefined;
  const fullInput = langfuseInput(input);
  const fullOutput = langfuseOutput(input);
  const baseMetadata = {
    ...safeMetadata(input.metadata),
    project: "doc-maker",
    runId: input.runId ?? null,
    nodeRunId: input.nodeRunId ?? null,
    nodeId: input.nodeType,
    nodeType: input.nodeType,
    artifactId: input.outputArtifact.id,
    artifactKind: input.outputArtifact.kind,
    evalRunId: input.evalResult?.id ?? null,
    upstreamTraceId: input.upstreamTraceId ?? null,
  };
  const batch: LangfuseIngestionEvent[] = [
    {
      id: eventId("trace_event"),
      timestamp: at,
      type: "trace-create",
      body: {
        id: traceId,
        timestamp: at,
        name: `doc-maker:${input.runId ?? "adhoc"}`,
        input: fullInput,
        output: fullOutput,
        sessionId: input.runId,
        environment: settings.environment,
        tags: ["doc-maker", "workflow-core", input.nodeType],
        metadata: baseMetadata,
      },
    },
    {
      id: eventId("generation_event"),
      timestamp: at,
      type: "generation-create",
      body: {
        id: observationId,
        traceId,
        name: input.nodeType,
        startTime: at,
        endTime: at,
        model: input.model,
        input: fullInput,
        output: fullOutput,
        level: input.status === "failed" ? "ERROR" : "DEFAULT",
        statusMessage,
        metadata: baseMetadata,
      },
    },
  ];

  if (typeof input.evalResult?.score === "number") {
    batch.push({
      id: eventId("score_event"),
      timestamp: at,
      type: "score-create",
      body: {
        id: stableUuid(`${input.evalResult.id}:${input.localTraceId}`),
        traceId,
        observationId,
        name: input.evalResult.kind,
        value: input.evalResult.score,
        dataType: "NUMERIC",
        environment: settings.environment,
        comment: input.evalResult.status,
        metadata: baseMetadata,
      },
    });
  }

  await postIngestion(batch);

  return {
    traceId,
    observationId,
  };
}

export async function writeLangfuseEvalScores(input: {
  runId: string;
  nodeRunId?: string;
  trace: LLMCallTraceRecord;
  evalRun: CoreEvalRun;
  metadata?: WorkflowMetadata;
}) {
  const settings = getLangfuseSettings();
  if (!settings.configured) {
    return {
      status: "skipped" as const,
      scoreCount: 0,
      error: "Langfuse env missing",
    };
  }

  const traceId = input.trace.langfuseTraceId ?? input.trace.runId ?? input.runId;
  const observationId = input.trace.langfuseObservationId ?? input.trace.nodeRunId ?? input.nodeRunId;
  const at = new Date().toISOString();
  const batch = input.evalRun.candidateResults.flatMap((candidate) =>
    candidate.attribution.map<LangfuseIngestionEvent>((attribution) => ({
      id: eventId("score_event"),
      timestamp: at,
      type: "score-create",
      body: {
        id: stableUuid(`${input.evalRun.id}:${candidate.candidateId}:${attribution.dimensionId}`),
        traceId,
        observationId,
        name: `candidate.${attribution.dimensionId}`,
        value: attribution.score,
        dataType: "NUMERIC",
        environment: settings.environment,
        comment: attribution.evidence.slice(0, 500),
        metadata: {
          ...safeMetadata(input.metadata),
          project: "doc-maker",
          runId: input.runId,
          nodeRunId: input.nodeRunId ?? input.trace.nodeRunId ?? null,
          nodeId: input.trace.nodeType,
          candidateId: candidate.candidateId,
          evalRunId: input.evalRun.id,
          evalKind: input.evalRun.kind,
          profileVersion: input.evalRun.profileVersion,
          dimensionId: attribution.dimensionId,
          dimensionLabel: attribution.label,
          status: attribution.status,
          source: attribution.source,
          guidance: attribution.guidance,
        },
      },
    })),
  );

  if (!batch.length) {
    return {
      status: "skipped" as const,
      scoreCount: 0,
    };
  }

  await postIngestion(batch);

  return {
    status: "complete" as const,
    scoreCount: batch.length,
  };
}

export async function writeLangfuseFeedbackScore(input: {
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
}) {
  const settings = getLangfuseSettings();
  if (!settings.configured) {
    return {
      status: "skipped" as const,
      scoreCount: 0,
      error: "Langfuse env missing",
    };
  }

  const traceId = input.trace.langfuseTraceId ?? input.trace.runId ?? input.runId;
  const observationId = input.trace.langfuseObservationId ?? input.trace.nodeRunId ?? input.nodeRunId;
  const at = new Date().toISOString();

  await postIngestion([
    {
      id: eventId("feedback_score_event"),
      timestamp: at,
      type: "score-create",
      body: {
        id: stableUuid(`${input.feedbackId}:${input.name}`),
        traceId,
        observationId,
        name: input.name,
        value: input.value,
        dataType: input.dataType,
        environment: settings.environment,
        comment: input.comment?.slice(0, 500),
        metadata: {
          ...safeMetadata(input.metadata),
          project: "doc-maker",
          runId: input.runId,
          nodeRunId: input.nodeRunId ?? input.trace.nodeRunId ?? null,
          nodeId: input.trace.nodeType,
          feedbackId: input.feedbackId,
          targetArtifactId: input.targetArtifactId ?? null,
        },
      },
    },
  ]);

  return {
    status: "complete" as const,
    scoreCount: 1,
  };
}
