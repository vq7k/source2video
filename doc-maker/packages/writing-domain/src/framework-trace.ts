import type {
  FrameworkArtifact,
  FrameworkEvalRun,
  FrameworkNodeRunRecord,
  LLMCallTraceRecord,
} from "@doc-maker/writing-domain/framework-run-types";
import { getTraceSink } from "@source2video/observability/trace-sink";
import { createNodeRunId } from "@source2video/workflow-core/node";
import type { LLMProviderResponse } from "@doc-maker/writing-domain/llm/types";
import type {
  CandidateRecord,
  EvalRun,
  HumanFeedbackRecord,
  PrecheckRun,
  RulePatchRecord,
  WritingRuleScopeRecord,
  WritingRunRecord,
} from "@doc-maker/writing-domain/types";

function now() {
  return new Date().toISOString();
}

function frameworkEvalFromScope(scope: WritingRuleScopeRecord): FrameworkEvalRun {
  return {
    id: scope.eval.id,
    kind: "scope_extraction_eval",
    status: "complete",
    score: scope.eval.score,
    source: scope.source,
    checks: scope.eval.checks,
  };
}

function frameworkEvalFromWritingEval(evalRun: EvalRun): FrameworkEvalRun {
  const coreEval = evalRun.coreEval;
  if (!coreEval) {
    return {
      id: evalRun.id,
      kind: "candidate_eval",
      status: "complete",
      score: null,
      source: "baseline_eval_profile",
      checks: [
        {
          label: "candidate scoring",
          status: "pass",
          evidence: "基础质量、任务匹配、格式契约、风格偏好、风险扣分均已归因。",
          guidance: "人工只做轻反馈，规则更新和重跑生成解耦。",
        },
      ],
    };
  }

  const totals = coreEval.candidateResults.map((result) => result.total);
  const meanScore = totals.length
    ? Math.round(totals.reduce((sum, score) => sum + score, 0) / totals.length)
    : null;

  return {
    id: evalRun.id,
    kind: coreEval.kind,
    status: "complete",
    score: meanScore,
    source: coreEval.profileSource,
    checks: coreEval.candidateResults.flatMap((result) =>
      result.attribution.map((item) => ({
        label: `${result.candidateId} / ${item.label}`,
        status: item.status,
        evidence: item.evidence,
        guidance: item.guidance,
      })),
    ),
  };
}

function frameworkRun(
  nodeType: FrameworkNodeRunRecord["nodeType"],
  layer: FrameworkNodeRunRecord["layer"],
  inputRefs: string[],
  artifacts: FrameworkNodeRunRecord["artifacts"],
  evalRuns: FrameworkEvalRun[] = [],
  traceLines: string[] = [],
  llmCalls: LLMCallTraceRecord[] = [],
): FrameworkNodeRunRecord {
  const at = now();
  const nodeRunId = llmCalls.find((call) => call.nodeRunId)?.nodeRunId ?? createNodeRunId();

  return {
    id: nodeRunId,
    nodeId: nodeType,
    nodeType,
    layer,
    status: "complete",
    startedAt: at,
    completedAt: at,
    inputs: inputRefs,
    artifacts,
    evalRuns,
    llmCalls: llmCalls.map((call) => ({
      ...call,
      nodeRunId: call.nodeRunId ?? nodeRunId,
    })),
    trace: traceLines,
  };
}

export function normalizeFrameworkTraceBindings(run: WritingRunRecord): WritingRunRecord {
  const frameworkRuns = (run.frameworkRuns ?? []).map((node) => ({
    ...node,
    llmCalls: (node.llmCalls ?? []).map((call) => ({
      ...call,
      runId: call.runId ?? run.id,
      nodeRunId: call.nodeRunId ?? node.id,
    })),
  }));
  const callBindings = new Map(
    frameworkRuns.flatMap((node) =>
      (node.llmCalls ?? []).map((call) => [
        call.id,
        {
          runId: call.runId ?? run.id,
          nodeRunId: call.nodeRunId ?? node.id,
        },
      ] as const),
    ),
  );
  const llmTraces = (run.llmTraces ?? []).map((call) => {
    const binding = callBindings.get(call.id);

    return {
      ...call,
      runId: call.runId ?? binding?.runId ?? run.id,
      nodeRunId: call.nodeRunId ?? binding?.nodeRunId,
    };
  });

  return {
    ...run,
    frameworkRuns,
    llmTraces,
  };
}

export async function captureRuntimeLLMTrace({
  status,
  provider = "mock-runtime",
  model,
  promptVersion,
  nodeType,
  inputRefs,
  outputArtifact,
  runId,
  evalResult,
  upstreamTraceId,
  latencyMs = 0,
  metadata,
  llmResponse,
}: {
  status?: LLMCallTraceRecord["status"];
  provider?: string;
  model: string;
  promptVersion: string;
  nodeType: FrameworkNodeRunRecord["nodeType"];
  inputRefs: string[];
  outputArtifact: FrameworkArtifact;
  runId?: string;
  evalResult?: LLMCallTraceRecord["evalResult"];
  upstreamTraceId?: string;
  latencyMs?: number;
  metadata?: LLMCallTraceRecord["metadata"];
  llmResponse?: Pick<LLMProviderResponse<unknown>, "requestPayload" | "responsePayload">;
}) {
  return getTraceSink().captureLLMCall({
    status,
    provider,
    model,
    promptVersion,
    nodeType,
    inputRefs,
    inputPayload: llmResponse?.requestPayload,
    outputArtifact,
    outputPayload: llmResponse?.responsePayload,
    runId,
    evalResult,
    upstreamTraceId,
    latencyMs,
    metadata,
  });
}

export function scopeFrameworkRun(scope: WritingRuleScopeRecord): FrameworkNodeRunRecord {
  return frameworkRun(
    "scope_extraction",
    "L1",
    ["quick_intake", scope.referencePaste ? "reference_paste" : "baseline_scope"],
    [
      {
        id: scope.id,
        kind: "writing_rule_scope",
        label: "写作规则范围",
        summary: `${scope.items.length} 条范围项；${scope.source}；评分 ${scope.eval.score}`,
      },
    ],
    [frameworkEvalFromScope(scope)],
    [`${scope.llmTrace.provider} 从有限文本输入中提炼结构、语气、禁忌和检查点。`],
    [scope.llmTrace],
  );
}

export function precheckFrameworkRun(
  runId: string,
  precheckRun: PrecheckRun,
  scope: WritingRuleScopeRecord,
  llmTrace: LLMCallTraceRecord,
): FrameworkNodeRunRecord {
  return frameworkRun(
    "precheck_normalization",
    "L1",
    ["job_spec", "output_contract", scope.id],
    [
      {
        id: precheckRun.id,
        kind: "precheck_candidate",
        label: "生成前检查候选",
        summary: `${precheckRun.writingRulesCandidate.length} 条规则；${precheckRun.riskChecks.length} 条风险检查`,
        ref: runId,
      },
    ],
    [],
    ["输入契约 + 输出契约 + 写作规则范围已归一为生成契约。"],
    [llmTrace],
  );
}

export function candidateBatchFrameworkRun(
  run: WritingRunRecord,
  evalRun: EvalRun,
  candidateIds: string[],
): FrameworkNodeRunRecord {
  return frameworkRun(
    "candidate_batch",
    "L1",
    ["precheck_candidate", "rule_snapshot"],
    [
      {
        id: `candidate_batch_${run.id}_r${run.round ?? 1}`,
        kind: "candidate_batch",
        label: "候选批次",
        summary: `${candidateIds.length} 条独立候选路径；第 ${run.round ?? 1} 批`,
      },
    ],
    [frameworkEvalFromWritingEval(evalRun)],
    ["批次只负责聚合同一轮候选路径；生成和评估由子节点分别记录。"],
  );
}

export function candidateGenerationFrameworkRun(
  run: WritingRunRecord,
  candidate: CandidateRecord,
  llmTrace: LLMCallTraceRecord,
): FrameworkNodeRunRecord {
  return frameworkRun(
    "candidate_generation",
    "L1",
    ["precheck_candidate", candidate.generatedByRuleSnapshotId ?? "rule_snapshot"],
    [
      {
        id: candidate.id,
        kind: "candidate_text",
        label: "候选正文",
        summary: candidate.title,
        ref: run.id,
      },
    ],
    [],
    ["单个候选由一次独立模型调用生成；评分不在本节点完成。"],
    [llmTrace],
  );
}

export function candidateEvalFrameworkRun(
  run: WritingRunRecord,
  candidate: CandidateRecord,
  evalRun: EvalRun,
  evalTrace: LLMCallTraceRecord,
): FrameworkNodeRunRecord {
  return frameworkRun(
    "candidate_eval",
    "L2",
    [candidate.id, "eval_profile", "precheck_candidate"],
    [
      {
        id: evalRun.id,
        kind: "candidate_eval",
        label: "候选评估",
        summary: `${candidate.title} / ${evalRun.candidateResults[0]?.total ?? "待评估"}`,
        ref: run.id,
      },
    ],
    [frameworkEvalFromWritingEval(evalRun)],
    ["候选评估独立于生成节点；推荐只能读取本节点结果。"],
    [evalTrace],
  );
}

export function feedbackFrameworkRun(
  run: WritingRunRecord,
  feedback: HumanFeedbackRecord,
  llmTrace: LLMCallTraceRecord,
): FrameworkNodeRunRecord {
  return frameworkRun(
    "feedback_reasoning",
    "L2",
    [feedback.candidateId, "feedback_ledger"],
    [
      {
        id: feedback.id,
        kind: "human_feedback",
        label: "人工反馈",
        summary: `${feedback.kind} / ${feedback.businessReason ?? feedback.score ?? "无评分"}`,
        ref: run.id,
      },
    ],
    [],
    ["人工反馈先追加到账本；规则草稿编译是独立步骤。"],
    [llmTrace],
  );
}

export function rulePatchFrameworkRun(
  run: WritingRunRecord,
  patch: RulePatchRecord,
  llmTrace: LLMCallTraceRecord,
): FrameworkNodeRunRecord {
  return frameworkRun(
    "rule_patch_compilation",
    "L2",
    [patch.sourceCandidateId, "feedback_ledger", "rule_patch_pool"],
    [
      {
        id: patch.id,
        kind: "rule_patch",
        label: "规则草稿",
        summary: `${patch.feedbackIds.length} 条反馈编译为规则草稿`,
        ref: run.id,
      },
    ],
    [],
    ["反馈已编译为有上限的规则草稿；候选历史保持不可变。"],
    [llmTrace],
  );
}
