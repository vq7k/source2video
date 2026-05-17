import {
  runDeterministicEval,
  type CoreEvalAttribution,
  type CoreEvalDimension,
} from "@/lib/workflow-core/eval";
import { getScoreSink } from "@/lib/score-sink";
import type { LLMCallTraceRecord } from "@/lib/framework-run-types";
import type {
  CandidateRecord,
  EvalRun,
  HumanFeedbackRecord,
  TextOutputContract,
  WritingJobSpec,
  PrecheckRun,
} from "@/lib/writing-run-types";

type WritingEvalInput = {
  runId: string;
  round: number;
  outputContract: TextOutputContract;
  jobSpec: WritingJobSpec;
  precheckRun: PrecheckRun;
  candidates: CandidateRecord[];
};

const WRITING_EVAL_DIMENSIONS: CoreEvalDimension[] = [
  {
    id: "quality",
    label: "基础质量",
    source: "基线质量评分口径",
    warningBelow: 24,
    blockedBelow: 18,
    guidance: "检查段落是否完整、观点是否清晰、结论是否可追问。",
  },
  {
    id: "fit",
    label: "任务匹配",
    source: "评分口径 + 内容摘要",
    warningBelow: 28,
    blockedBelow: 20,
    guidance: "检查候选是否回应本轮任务、受众、渠道和素材边界。",
  },
  {
    id: "format",
    label: "格式契约",
    source: "输出契约",
    includeInTotal: false,
    warningBelow: 28,
    blockedBelow: 20,
    guidance: "检查候选是否满足产物类型、长度范围、结构和格式规则。",
  },
  {
    id: "style",
    label: "风格偏好",
    source: "写作规则候选 + 评审偏好",
    warningBelow: 22,
    blockedBelow: 16,
    guidance: "检查候选是否遵守本轮写法规则、语气和主管偏好。",
  },
  {
    id: "risk",
    label: "风险扣分",
    source: "风险检查 / 依据边界 / 相似表达",
    polarity: "negative",
    warningAtOrBelow: -6,
    blockedAtOrBelow: -9,
    guidance: "检查事实漂移、证据缺口、相似表达和交付契约风险。",
  },
];

function toWritingDimension(label: string): EvalRun["candidateResults"][number]["attribution"][number]["dimension"] {
  switch (label) {
    case "基础质量":
    case "任务匹配":
    case "格式契约":
    case "风格偏好":
    case "风险扣分":
      return label;
    default:
      return "基础质量";
  }
}

function toWritingAttribution(
  attribution: CoreEvalAttribution,
): EvalRun["candidateResults"][number]["attribution"][number] {
  return {
    dimension: toWritingDimension(attribution.label),
    source: attribution.source,
    evidence: attribution.evidence,
    score: attribution.score,
  };
}

export function buildWritingCandidateEvalRun(input: WritingEvalInput): EvalRun {
  const profileVersion = `baseline-eval-profile-v0.1-r${input.round}`;
  const riskSummary = input.precheckRun.riskChecks.map((item) => `${item.label}:${item.level}`).join(" / ");
  const outputContractEvidence = `${input.outputContract.artifactType} / ${input.outputContract.lengthRange} / ${input.outputContract.structure} / ${input.outputContract.formatRules}`;
  const riskEvidence = input.precheckRun.riskChecks.map((item) => item.reason).join(" ");
  const coreEval = runDeterministicEval({
    id: `core_eval_${input.runId}_r${input.round}`,
    kind: "writing_candidate_eval",
    profileVersion,
    profileSource: "baseline_eval_profile",
    riskSummary,
    dimensions: WRITING_EVAL_DIMENSIONS,
    candidates: input.candidates.map((candidate) => ({
      id: candidate.id,
      total: candidate.total,
      scores: {
        quality: candidate.breakdown.quality,
        fit: candidate.breakdown.fit,
        format: candidate.breakdown.fit,
        style: candidate.breakdown.style,
        risk: candidate.breakdown.risk,
      },
      evidence: {
        quality: "段落完整、观点清晰、结论可追问。",
        fit: input.precheckRun.contentBrief,
        format: outputContractEvidence,
        style: input.jobSpec.reviewPreference,
        risk: riskEvidence,
      },
    })),
  });

  return {
    id: `eval_${input.runId}_r${input.round}`,
    round: input.round,
    status: "complete",
    profileVersion,
    riskSummary,
    coreEval,
    candidateResults: coreEval.candidateResults.map((result) => ({
      candidateId: result.candidateId,
      total: result.total,
      strongestSignal: result.strongestSignal,
      weakestSignal: result.weakestSignal,
      attribution: result.attribution.map(toWritingAttribution),
    })),
  };
}

export async function writeWritingCandidateEvalScores(input: {
  runId: string;
  nodeRunId?: string;
  trace: LLMCallTraceRecord;
  evalRun: EvalRun;
  round: number;
}) {
  if (!input.evalRun.coreEval) {
    return {
      sink: "local-json" as const,
      status: "skipped" as const,
      scoreCount: 0,
    };
  }

  return getScoreSink().writeEvalScores({
    runId: input.runId,
    nodeRunId: input.nodeRunId,
    trace: input.trace,
    evalRun: input.evalRun.coreEval,
    metadata: {
      round: input.round,
      writingEvalRunId: input.evalRun.id,
    },
  });
}

export async function writeWritingHumanFeedbackScore(input: {
  runId: string;
  nodeRunId?: string;
  trace: LLMCallTraceRecord;
  feedback: HumanFeedbackRecord;
}) {
  const score = typeof input.feedback.score === "number" ? input.feedback.score : null;
  const categoricalValue =
    input.feedback.businessReason ?? input.feedback.verdict ?? input.feedback.kind;

  return getScoreSink().writeFeedbackScore({
    runId: input.runId,
    nodeRunId: input.nodeRunId,
    trace: input.trace,
    feedbackId: input.feedback.id,
    targetArtifactId: input.feedback.candidateId,
    name: score === null ? "human.feedback_label" : "human.feedback_score",
    value: score ?? categoricalValue,
    dataType: score === null ? "CATEGORICAL" : "NUMERIC",
    comment: input.feedback.issue ?? input.feedback.note,
    metadata: {
      feedbackKind: input.feedback.kind,
      verdict: input.feedback.verdict ?? null,
      businessReason: input.feedback.businessReason ?? null,
      likelyCause: input.feedback.likelyCause ?? null,
      confidence: input.feedback.confidence ?? null,
    },
  });
}
