import type { FrameworkNodeType, LLMCallTraceRecord } from "@doc-maker/writing-domain/framework-run-types";
import type { WritingRunRecord } from "@doc-maker/writing-domain/types";

export type BusinessLLMNodeMonitorStatus = "complete" | "failed" | "fallback" | "missing";

export type BusinessLLMNodeMonitor = {
  key: string;
  nodeType: FrameworkNodeType;
  label: string;
  role: string;
  status: BusinessLLMNodeMonitorStatus;
  providerModel: string;
  promptVersion: string;
  sink: string;
  latencyLabel: string;
  inputLabel: string;
  outputSummary: string;
  evalLabel: string;
  traceId?: string;
  langfuseTraceId?: string;
  nodeRunId?: string;
  detailHref: string;
};

const LIGHTWEIGHT_NODE_COPY: Record<FrameworkNodeType, { label: string; role: string }> = {
  scope_extraction: {
    label: "写作规则范围",
    role: "把一句话想法和参考片段压缩为本轮写法范围。",
  },
  precheck_normalization: {
    label: "生成前检查",
    role: "把输入契约 / 输出契约清洗成生成契约。",
  },
  candidate_generation: {
    label: "候选生成",
    role: "按当前规则快照生成单个候选正文，不负责评分。",
  },
  candidate_eval: {
    label: "候选评估",
    role: "独立读取候选正文和契约，按评分口径输出归因。",
  },
  feedback_reasoning: {
    label: "反馈归因",
    role: "把选中文本反馈归因成可处理的问题类型。",
  },
  feedback_compilation: {
    label: "反馈整理",
    role: "把反馈整理为结构化账本。",
  },
  rule_patch_compilation: {
    label: "规则草稿编译",
    role: "把反馈账本编译成下一轮规则草稿。",
  },
};

const DEFAULT_LIGHTWEIGHT_NODES: FrameworkNodeType[] = [
  "scope_extraction",
  "precheck_normalization",
];

function collectTraces(run: WritingRunRecord) {
  const traces = new Map<string, LLMCallTraceRecord>();

  for (const trace of run.llmTraces ?? []) {
    traces.set(trace.id, trace);
  }

  for (const trace of run.frameworkRuns?.flatMap((node) => node.llmCalls ?? []) ?? []) {
    traces.set(trace.id, trace);
  }

  return Array.from(traces.values()).sort((left, right) => left.at.localeCompare(right.at));
}

function isFallback(trace?: LLMCallTraceRecord) {
  if (!trace) {
    return false;
  }

  return (
    trace.metadata?.fallback === true ||
    trace.provider.includes("fallback") ||
    trace.promptVersion.includes("fallback")
  );
}

function statusFor(trace?: LLMCallTraceRecord): BusinessLLMNodeMonitorStatus {
  if (!trace) {
    return "missing";
  }
  if (trace.status === "failed") {
    return "failed";
  }
  if (isFallback(trace)) {
    return "fallback";
  }
  return "complete";
}

function evalLabel(trace?: LLMCallTraceRecord) {
  if (!trace?.evalResult) {
    return "skipped";
  }

  const score = typeof trace.evalResult.score === "number" ? ` / ${trace.evalResult.score}` : "";
  return `${trace.evalResult.status}${score}`;
}

function monitoredNodeTypes(run: WritingRunRecord, traces: LLMCallTraceRecord[]) {
  const types = new Set<FrameworkNodeType>(DEFAULT_LIGHTWEIGHT_NODES);

  if (run.feedback.length || traces.some((trace) => trace.nodeType === "feedback_reasoning")) {
    types.add("feedback_reasoning");
  }

  if (run.rulePatches.length || traces.some((trace) => trace.nodeType === "rule_patch_compilation")) {
    types.add("rule_patch_compilation");
  }

  return Array.from(types);
}

export function buildBusinessLLMNodeMonitors(run: WritingRunRecord): BusinessLLMNodeMonitor[] {
  const traces = collectTraces(run);

  return monitoredNodeTypes(run, traces).map((nodeType) => {
    const trace = traces.filter((item) => item.nodeType === nodeType).at(-1);
    const node = run.frameworkRuns?.find((item) => item.id === trace?.nodeRunId || item.nodeType === nodeType);
    const copy = LIGHTWEIGHT_NODE_COPY[nodeType];

    return {
      key: `${nodeType}:${trace?.id ?? "missing"}`,
      nodeType,
      label: copy.label,
      role: copy.role,
      status: statusFor(trace),
      providerModel: trace ? `${trace.provider} / ${trace.model}` : "waiting trace",
      promptVersion: trace?.promptVersion ?? "waiting",
      sink: trace?.sink ?? "none",
      latencyLabel: trace?.latencyMs ? `${trace.latencyMs}ms` : "none",
      inputLabel: trace?.inputRefs.join(", ") ?? "waiting",
      outputSummary: trace?.outputArtifact.summary ?? "尚未记录输出摘要。",
      evalLabel: evalLabel(trace),
      traceId: trace?.id,
      langfuseTraceId: trace?.langfuseTraceId,
      nodeRunId: trace?.nodeRunId ?? node?.id,
      detailHref: node
        ? `/framework?runId=${run.id}&nodeRunId=${node.id}`
        : `/framework?runId=${run.id}&node=${nodeType}`,
    };
  });
}
