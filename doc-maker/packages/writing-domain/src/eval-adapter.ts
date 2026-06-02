import {
  runDeterministicEval,
  type CoreEvalAttribution,
  type CoreEvalDimension,
} from "@doc-maker/workflow-core/eval";
import { getScoreSink } from "@doc-maker/observability/score-sink";
import type { LLMCallTraceRecord } from "@doc-maker/writing-domain/framework-run-types";
import type {
  CandidateRecord,
  EvalRun,
  HumanFeedbackRecord,
  TextOutputContract,
  WritingJobSpec,
  PrecheckRun,
} from "@doc-maker/writing-domain/types";

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
    guidance: "检查候选是否遵守本轮写法规则、语气和评审偏好。",
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

const STYLE_RISK_WORDS = [
  "颠覆",
  "革命性",
  "遥遥领先",
  "震撼",
  "爆款",
  "神器",
  "玄学",
  "宇宙",
  "无限宝石",
  "漫威",
];

function compactText(text: string) {
  return text.replace(/\s+/g, "");
}

function extractTerms(text: string) {
  const terms: string[] = [];
  for (const token of text.match(/[\p{Script=Han}]{2,}|[A-Za-z0-9]{2,}/gu) ?? []) {
    if (/^[\p{Script=Han}]+$/u.test(token)) {
      for (let index = 0; index < token.length - 1; index += 1) {
        terms.push(token.slice(index, index + 2));
      }
    } else {
      terms.push(token);
    }
  }

  return Array.from(new Set(terms)).slice(0, 80);
}

function countTermHits(text: string, terms: string[]) {
  const lower = text.toLowerCase();
  return terms.filter((term) => lower.includes(term.toLowerCase())).length;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function scoreWritingCandidate(input: {
  candidate: CandidateRecord;
  outputContract: TextOutputContract;
  jobSpec: WritingJobSpec;
  precheckRun: PrecheckRun;
}) {
  const text = input.candidate.excerpt;
  const compact = compactText(text);
  const paragraphCount = text.split(/\n{2,}/).filter((item) => item.trim()).length;
  const sentenceCount = text.split(/[。！？!?]/).filter((item) => item.trim()).length;
  const sourceTerms = extractTerms(
    [
      input.jobSpec.title,
      input.jobSpec.goal,
      input.jobSpec.source,
      input.precheckRun.contentBrief,
      input.precheckRun.groundingBrief,
      input.precheckRun.writingRulesCandidate.join(" "),
    ].join(" "),
  );
  const termHits = countTermHits(text, sourceTerms);
  const ruleHits = countTermHits(text, input.precheckRun.writingRulesCandidate);
  const styleRiskHits = STYLE_RISK_WORDS.filter((word) => text.includes(word));
  const riskWarnings = input.precheckRun.riskChecks.filter((item) => item.level !== "low");
  const unsupportedClaimRisk = /(数据显示|研究表明|用户都|业内公认|事实证明)/.test(text) ? 2 : 0;

  const quality = clamp(
    16 +
      Math.min(8, Math.floor(compact.length / 28)) +
      (sentenceCount >= 2 ? 3 : 0) +
      (sentenceCount <= 4 ? 2 : 0) +
      (paragraphCount >= 2 ? 2 : 0) +
      (input.candidate.title.trim() ? 2 : 0),
    0,
    35,
  );
  const fit = clamp(16 + Math.min(termHits, 12) + Math.min(ruleHits, 4), 0, 35);
  const style = clamp(
    22 +
      (sentenceCount >= 2 && sentenceCount <= 4 ? 3 : 0) +
      (/[：；]/.test(text) ? 1 : 0) -
      styleRiskHits.length * 3 +
      (input.jobSpec.reviewPreference ? 2 : 0),
    0,
    30,
  );
  const risk = -clamp(riskWarnings.length + unsupportedClaimRisk + styleRiskHits.length, 0, 10);

  return {
    scores: {
      quality,
      fit,
      format: fit,
      style,
      risk,
    },
    total: quality + fit + style + risk,
    evidence: {
      quality: `正文约 ${compact.length} 字，${sentenceCount} 句，${paragraphCount} 个段落；检查是否完整、清晰、可直接阅读。`,
      fit: `命中 ${termHits}/${sourceTerms.length || 0} 个任务/边界关键词；规则命中 ${ruleHits} 条。`,
      format: `${input.outputContract.artifactType || "未指定产物类型"} / ${input.outputContract.lengthRange || "未指定长度"} / ${input.outputContract.structure || "未指定结构"}`,
      style: styleRiskHits.length
        ? `检测到可能偏离克制风格的词：${styleRiskHits.join(" / ")}。`
        : "未检测到明显营销腔、玄学化或版权角色表达。",
      risk: riskWarnings.length
        ? input.precheckRun.riskChecks.map((item) => `${item.label}:${item.level}`).join(" / ")
        : "未检测到高风险项；仍需人工确认事实边界。",
    },
  };
}

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
  const coreEval = runDeterministicEval({
    id: `core_eval_${input.runId}_r${input.round}`,
    kind: "writing_candidate_eval",
    profileVersion,
    profileSource: "baseline_eval_profile",
    riskSummary,
    dimensions: WRITING_EVAL_DIMENSIONS,
    candidates: input.candidates.map((candidate) => {
      const scored = scoreWritingCandidate({
        candidate,
        outputContract: input.outputContract,
        jobSpec: input.jobSpec,
        precheckRun: input.precheckRun,
      });

      return {
        id: candidate.id,
        total: scored.total,
        scores: scored.scores,
        evidence: scored.evidence,
      };
    }),
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
