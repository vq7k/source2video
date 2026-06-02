"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";

import {
	AlertTriangle,
	ArrowRight,
	BookOpenCheck,
	CheckCircle2,
  ChevronLeft,
  Copy,
  Download,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  LinearJobList,
  LinearSidebar,
  LinearSidebarRail,
  LinearTopBar,
  jobViewForRun,
  runStateLabel,
  type AppSection,
  type CenterMode,
  type JobView,
} from "@/components/writing-production/linear-shell";
import {
  InfoRow,
  StepMark,
  WarningCallout,
} from "@/components/writing-production/common";
import {
  DecisionQueuePanel,
} from "@/components/writing-production/decision-panels";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { FrameworkNodeRunRecord, LLMCallTraceRecord } from "@doc-maker/writing-domain/framework-run-types";
import {
  compileWritingRulePatch,
  confirmWritingRun,
  createRulePackageDraft,
  createWritingRunRecord,
  deleteWritingFeedback,
  deriveRuleScope,
  finalizeWritingRunRecord,
  listRulePackages,
  listWritingRuns,
  publishRulePackageDraft,
  recordWritingFeedback,
  runWritingGenerationBatch,
} from "@/lib/writing-run-client";
import type {
  CandidateRecord,
  CreateWritingRunInput,
  HumanFeedbackInput,
  HumanFeedbackRecord,
  RulePackageRecord,
  TextOutputContract,
  WritingJobSpec,
  WritingRuleScopeItem,
  WritingRuleScopeRecord,
  WritingRunRecord,
} from "@doc-maker/writing-domain/types";
import { cn } from "@/lib/utils";

type FlowStage = "intake" | "precheck" | "review" | "finalize";

type JobSpec = WritingJobSpec;

type OutputContract = TextOutputContract;

type QuickIntake = {
  raw: string;
  referencePaste: string;
};

type RuntimeTaskKind =
  | "scope_extraction"
  | "precheck_normalization"
  | "candidate_generation"
  | "feedback_reasoning"
  | "rule_patch_compilation"
  | "generation_batch";

type SelectionFeedbackDraft = {
  candidateId: string;
  quote: string;
  verdict: NonNullable<HumanFeedbackRecord["verdict"]>;
  businessReason: NonNullable<HumanFeedbackRecord["businessReason"]>;
  likelyCause: NonNullable<HumanFeedbackRecord["likelyCause"]>;
  issue: string;
  expected: string;
  confidence: NonNullable<HumanFeedbackRecord["confidence"]>;
};

type SourceKey = "intent" | "evidence" | "output" | "style" | "review";

type BaselineCheck = {
  title: string;
  source: string;
  sourceKeys: SourceKey[];
  method: string;
  detail: string;
  impact: string;
  iteration: string;
  badge?: string;
};

type RuleScopeComparisonColumn = {
  title: string;
  badge: ReactNode;
  summary: string;
  bullets: string[];
};

type SourceCoverageItem = {
  label: string;
  status: "covered" | "missing" | "risk";
  detail: string;
};

type SkillPackageOption = {
  id: string;
  category: string;
  version: string;
  status: string;
  description: string;
  prefill: Pick<JobSpec, "writingReference" | "reviewPreference">;
  rulePackage?: RulePackageRecord;
};

type OutputTypeProfile = {
  id: string;
  label: string;
  description: string;
  contract: OutputContract;
};

const initialJobSpec: JobSpec = {
  title: "",
  goal: "",
  source: "",
  writingReference: "",
  reviewPreference: "",
};

const legacySeedReviewPreferenceSuffix = "当前偏好：不要营销腔，不要泛泛谈 AI；标题克制，观点要可被追问。";
const legacyAutoGoalPattern = /^基于快速输入原始内容完成一篇.+；先明确核心判断，再给出可追溯依据和下一步建议。$/;

function ruleScopeReferenceText(ruleScope?: WritingRuleScopeRecord | null) {
  return ruleScope?.items.map((item) => `${scopeKindLabel[item.kind]}：${item.text}`).join("\n") ?? "";
}

function cleanLegacySeedSpec(spec: JobSpec, ruleScope?: WritingRuleScopeRecord | null): JobSpec {
  const autoRuleScopeReference = ruleScopeReferenceText(ruleScope);
  return {
    ...spec,
    goal: legacyAutoGoalPattern.test(spec.goal) ? "" : spec.goal,
    writingReference: spec.writingReference === autoRuleScopeReference ? "" : spec.writingReference,
    reviewPreference:
      spec.reviewPreference.endsWith(legacySeedReviewPreferenceSuffix) &&
      (spec.reviewPreference.includes("审美不稳定") || spec.reviewPreference.includes("评审偏好不稳定"))
        ? ""
        : spec.reviewPreference,
  };
}

function cleanLegacyOutputContract(contract?: OutputContract): OutputContract {
  if (!contract) {
    return initialOutputContract;
  }

  const isLegacyBaseline =
    contract.artifactType === "auto-detected text artifact" &&
    contract.lengthRange === "由本轮输入、上游产物和产物类型共同确定；不做全局字数预设。";
  return isLegacyBaseline ? initialOutputContract : contract;
}

function cleanLegacySeedRun(run: WritingRunRecord): WritingRunRecord {
  const cleanedSpec = cleanLegacySeedSpec(run.jobSpec, run.ruleScope);
  const quickInput = run.quickIntake?.trim() ?? "";
  const legacySourcePrefix = quickInput ? `快速输入原始内容：${quickInput}` : "";
  const sourceWithoutPrefix =
    legacySourcePrefix && cleanedSpec.source.trim() === legacySourcePrefix ? quickInput : cleanedSpec.source;

  return {
    ...run,
    jobSpec: {
      ...cleanedSpec,
      source: sourceWithoutPrefix,
    },
    outputContract: cleanLegacyOutputContract(run.outputContract),
  };
}

const initialQuickIntake: QuickIntake = {
  raw: "",
  referencePaste: "",
};

const outputProfile = {
  name: "文本产物",
  summary: "当前只预设文本生产流程，不全局预设短文、口播、TTS 或分镜内容规则。",
  artifacts: ["text_artifact"],
};

const initialOutputContract: OutputContract = {
  artifactType: "",
  lengthRange: "",
  structure: "",
  formatRules: "",
  groundingRules: "",
  specialHandling: "",
  downstreamHandoff: "",
};

const outputTypeProfiles: OutputTypeProfile[] = [
  {
    id: "auto",
    label: "无产物模板 / 由 LLM 建议",
    description: "不预设产物类型、长度或格式；由 Rule Scope 和 Precheck LLM 给出待确认建议。",
    contract: initialOutputContract,
  },
];

const baselineSkillPackageOptions: SkillPackageOption[] = [
  {
    id: "baseline-no-package",
    category: "本次文本",
    version: "Baseline / No Published Rule Package",
    status: "baseline mode",
    description: "不套用历史类型，只根据本次快速输入和输入契约生成临时写作规则候选。",
    prefill: {
      writingReference: "",
      reviewPreference: "",
    },
  },
];

function rulePackageToSkillPackageOption(rulePackage: RulePackageRecord): SkillPackageOption {
  return {
    id: rulePackage.id,
    category: rulePackage.category,
    version: rulePackage.version,
    status: "published rule package",
    description: rulePackage.summary,
    prefill: {
      writingReference: rulePackage.rules.map((rule) => rule.text).join("\n"),
      reviewPreference: "",
    },
    rulePackage,
  };
}

const autoFilledStack = [
  ["写作规则范围", "由快速输入和参考文本提炼结构、语气、禁忌、检查点，用户删减确认。"],
  ["输入契约", "渲染输入区字段：标题、目标、底稿、写法参考、评审偏好。"],
  ["生成前检查", "初始化内容摘要、依据边界、写作规则候选和风险检查。"],
  ["评分口径", "初始化基础质量、任务匹配、风格偏好、风险扣分和权重。"],
  ["输出契约", "默认 Auto，不预设口播、TTS、分镜或字数；具体规则来自类型配置和上游输入。"],
  ["写作约束", "带入结构、语气、禁止项、相似表达边界；不凭空发明专属风格。"],
  ["治理策略", "带入低置信通过、延迟反馈、回溯评分和规则清理策略。"],
];

const scopeKindLabel: Record<WritingRuleScopeItem["kind"], string> = {
  structure: "结构",
  tone: "语气",
  prohibition: "禁忌",
  checklist: "检查点",
};

const confidenceLabel: Record<WritingRuleScopeItem["confidence"], string> = {
  low: "低置信",
  medium: "中置信",
  high: "高置信",
};

const ruleScopeSourceLabel: Record<WritingRuleScopeRecord["source"], string> = {
  baseline: "仅基于本次输入",
  reference_paste: "参考文本",
  mixed: "本次输入 + 参考文本",
  template: "规则模板",
};

function SourceBadge({
  label,
  tone = "zinc",
}: {
  label: string;
  tone?: "zinc" | "blue" | "amber" | "violet" | "emerald";
}) {
  const toneClass = {
    zinc: "border-zinc-200 bg-zinc-50 text-zinc-700",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    violet: "border-violet-200 bg-violet-50 text-violet-800",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
  }[tone];

  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium", toneClass)}>
      {label}
    </span>
  );
}

function ruleScopeEffectText(item: WritingRuleScopeItem) {
  if (item.kind === "structure") {
    return `结构约束：${item.text}`;
  }
  if (item.kind === "tone") {
    return `语气约束：${item.text}`;
  }
  if (item.kind === "prohibition") {
    return `禁忌约束：${item.text}`;
  }
  return `检查点：${item.text}`;
}

function buildRuleScopeComparison({
  ruleScope,
  precheckRun,
}: {
  ruleScope: WritingRuleScopeRecord | null;
  precheckRun?: WritingRunRecord["precheckRun"] | null;
}): RuleScopeComparisonColumn[] {
  const appliedRules = ruleScope?.items.map(ruleScopeEffectText) ?? [];
  const precheckRules =
    precheckRun?.writingRulesCandidate.slice(0, 3).map((rule) => `Precheck 待确认：${rule}`) ?? [];

  return [
    {
      title: "A / 不应用规则",
      badge: <SourceBadge label="Job Spec only" tone="blue" />,
      summary: "只使用标题、目标、底稿等输入契约，不把 Rule Scope 作为生成约束。",
      bullets: [
        "候选可以回答任务，但结构、语气、禁忌不被显式约束。",
        "后续评分只能按通用质量和任务匹配判断，偏好归因较弱。",
        "适合验证：当前输入本身是否已经足够清楚。",
      ],
    },
    {
      title: "B / 应用规则",
      badge: (
        <SourceBadge
          label={ruleScope ? `${ruleScopeSourceLabel[ruleScope.source]} · ${ruleScope.items.length} 条` : "No Rule Scope"}
          tone={ruleScope?.source === "template" ? "violet" : "amber"}
        />
      ),
      summary: ruleScope
        ? "在同一 Job Spec 上叠加已确认 Rule Scope，并让 Precheck 把规则归一为候选生成契约。"
        : "尚未生成或加载 Rule Scope，无法比较规则影响。",
      bullets: [
        ...(appliedRules.length ? appliedRules.slice(0, 3) : ["暂无可应用规则。"]),
        ...(precheckRules.length ? precheckRules.slice(0, 2) : []),
      ],
    },
  ];
}

function buildSourceCoverage(run: WritingRunRecord | null, ruleScope: WritingRuleScopeRecord | null): SourceCoverageItem[] {
  const referenceProvided = Boolean((run?.referencePaste ?? ruleScope?.referencePaste ?? "").trim());
  const scopeUsesReference = ruleScope?.source === "reference_paste" || ruleScope?.source === "mixed";
  const highRiskCount = run?.precheckRun.riskChecks.filter((risk) => risk.level === "high").length ?? 0;

  return [
    {
      label: "本次输入",
      status: run?.quickIntake?.trim() ? "covered" : "missing",
      detail: run?.quickIntake?.trim() ? "已进入 Job Spec 和 Precheck 输入。" : "缺少快速输入，生成只能依赖后续手填字段。",
    },
    {
      label: "参考文本",
      status: referenceProvided ? (scopeUsesReference ? "covered" : "risk") : "missing",
      detail: referenceProvided
        ? scopeUsesReference
          ? "参考文本已进入 Rule Scope 来源。"
          : "提供了参考文本，但当前 Scope 未标记为参考来源，需要复查。"
        : "未提供参考文本；不会沉淀专属风格，只能生成 baseline 规则。",
    },
    {
      label: "规则范围",
      status: ruleScope?.items.length ? "covered" : "missing",
      detail: ruleScope?.items.length ? `${ruleScope.items.length} 条规则已确认，可进入生成契约。` : "尚无可应用规则。",
    },
    {
      label: "发布风险",
      status: highRiskCount > 0 ? "risk" : "covered",
      detail:
        highRiskCount > 0
          ? `${highRiskCount} 条高风险；可继续生成候选，但不能发布为 Rule Package。`
          : "未发现高风险；仍需候选评审后才能沉淀规则资产。",
    },
  ];
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function slugifyFileName(value: string) {
  const normalized = value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 64);

  return normalized || "text-artifact";
}

function titleFromQuickIntake(value: string) {
  const firstLine = value.split("\n").find((line) => line.trim())?.trim() ?? "";
  return firstLine.length > 52 ? `${firstLine.slice(0, 52)}...` : firstLine;
}

function outputTypeProfileIdFor(contract: OutputContract) {
  return (
    outputTypeProfiles.find(
      (profile) =>
        profile.contract.artifactType === contract.artifactType &&
        profile.contract.lengthRange === contract.lengthRange &&
        profile.contract.structure === contract.structure,
    )?.id ?? "custom"
  );
}

function buildCandidateDocHtml({
  candidate,
  jobSpec,
  outputContract,
  runId,
}: {
  candidate: CandidateRecord;
  jobSpec: JobSpec;
  outputContract: OutputContract;
  runId: string;
}) {
  const paragraphs = candidate.excerpt
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("\n");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(candidate.title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif; line-height: 1.75; color: #111827; }
    h1 { font-size: 22px; margin-bottom: 8px; }
    .meta { color: #4b5563; font-size: 12px; margin-bottom: 20px; }
    .contract { border: 1px solid #d1d5db; padding: 12px; margin: 16px 0; background: #f9fafb; }
    p { margin: 0 0 12px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(candidate.title)}</h1>
  <div class="meta">任务: ${escapeHtml(runId)} · 候选: ${escapeHtml(candidate.id)} · Eval: ${candidate.total}</div>
  <div class="contract">
    <strong>输入契约</strong><br />
    ${escapeHtml(jobSpec.title)}<br />
    ${escapeHtml(jobSpec.goal)}<br /><br />
    <strong>输出契约</strong><br />
    ${escapeHtml(outputContract.artifactType)} · ${escapeHtml(outputContract.lengthRange)}<br />
    ${escapeHtml(outputContract.structure)}
  </div>
  ${paragraphs}
</body>
</html>`;
}

function analyzeSelectionFeedback(
  draft: CandidateRecord,
  quote: string,
  verdict: SelectionFeedbackDraft["verdict"],
): SelectionFeedbackDraft {
  const normalizedQuote = quote.trim().replace(/\s+/g, " ").slice(0, 180);
  const hasRiskWord = /风险|相似|复制|漂移|编造|事实|缺少/.test(normalizedQuote);
  const hasStyleWord = /鸡汤|营销|夸张|口号|书面|口语|啰嗦|冗余/.test(normalizedQuote);
  const hasTaskWord = /目标|任务|评审|决策|下一步|闭环/.test(normalizedQuote);

  if (verdict === "liked") {
    return {
      candidateId: draft.id,
      quote: normalizedQuote,
      verdict,
      businessReason: "正向样本",
      likelyCause: "exemplar",
      issue: "这段表达可作为正向样本，保留其结构和语气信号。",
      expected: "下一轮优先复用这段的表达策略，但不复制原句。",
      confidence: "medium",
    };
  }

  if (verdict === "rewrite") {
    return {
      candidateId: draft.id,
      quote: normalizedQuote,
      verdict,
      businessReason: "表达冗余",
      likelyCause: "style",
      issue: "这段需要局部改写，问题更像表达密度或句式节奏，而不是全局任务错误。",
      expected: "压缩句子，保留判断和证据，减少解释性铺垫。",
      confidence: "medium",
    };
  }

  if (verdict === "rejected") {
    return {
      candidateId: draft.id,
      quote: normalizedQuote,
      verdict,
      businessReason: "风格不对",
      likelyCause: "style",
      issue: "这段表达不符合当前写法参考或评审偏好。",
      expected: "重写为更克制、更贴近目标读者的表达。",
      confidence: "medium",
    };
  }

  if (hasRiskWord || draft.risk.includes("事实漂移：中")) {
    return {
      candidateId: draft.id,
      quote: normalizedQuote,
      verdict,
      businessReason: "事实不稳",
      likelyCause: "rubric",
      issue: "选中文本可能越过底稿边界，或把低置信判断写成确定结论。",
      expected: "回到底稿证据；无法确认的内容保留为风险或待补材料。",
      confidence: "high",
    };
  }

  if (hasStyleWord || draft.breakdown.style < 22) {
    return {
      candidateId: draft.id,
      quote: normalizedQuote,
      verdict,
      businessReason: "风格不对",
      likelyCause: "style",
      issue: "选中文本与当前评审偏好或写法参考不一致。",
      expected: "保持克制、少口号、先判断再给证据。",
      confidence: "medium",
    };
  }

  if (!hasTaskWord || draft.breakdown.fit < 29) {
    return {
      candidateId: draft.id,
      quote: normalizedQuote,
      verdict,
      businessReason: "任务不准",
      likelyCause: "prompt",
      issue: "选中文本没有明显服务本轮沟通任务，可能造成跑题或重点漂移。",
      expected: "重新贴合输入契约里的目标和受众，明确判断与下一步。",
      confidence: "medium",
    };
  }

  return {
    candidateId: draft.id,
    quote: normalizedQuote,
    verdict,
    businessReason: "偏好不符",
    likelyCause: "single-case",
    issue: "LLM 没有找到强规则命中，暂按本轮偏好冲突记录为候选原因。",
    expected: "由用户确认原因后再进入反馈账本。",
    confidence: "low",
  };
}

const stageCopy: Record<
  FlowStage,
  {
    badge: string;
    description: string;
    nextTitle: string;
    nextHint: string;
    precheckMetric: string;
    draftsMetric: string;
  }
> = {
  intake: {
    badge: "intake",
    description: "默认使用 Baseline；历史 Rule Package 只在明确复用时选择。",
    nextTitle: "输入任务材料",
    nextHint: "Baseline 先服务本次任务；Rule Package 负责复用历史写法，不作为默认前提。",
    precheckMetric: "blocked",
    draftsMetric: "blocked",
  },
  precheck: {
    badge: "precheck",
    description: "检查区已自动根据输入区加载；确认前不会生成候选。",
    nextTitle: "确认生成契约",
    nextHint: "修改左侧输入会自动刷新检查区；进入候选区的动作在检查区底部。",
    precheckMetric: "ready",
    draftsMetric: "blocked",
  },
  review: {
    badge: "review",
    description: "检查结果已确认，本轮候选文本可按同一评分标准比较。",
    nextTitle: "评审候选区",
    nextHint: "选中文本打标签后自动生成规则草稿；需要新结果时再运行下一批。",
    precheckMetric: "review",
    draftsMetric: "3",
  },
  finalize: {
    badge: "finalize",
    description: "已停止本轮规则迭代，只选择最终版本并导出本次产物。",
    nextTitle: "定稿导出",
      nextHint: "从当前批次选择 1 个文本产物，然后导出 DOC。",
    precheckMetric: "review",
    draftsMetric: "final",
  },
};

const runtimeTaskCopy: Record<
  RuntimeTaskKind,
  {
    title: string;
    node: string;
    body: string;
    estimate: string;
  }
> = {
  scope_extraction: {
    title: "正在提炼写作规则范围",
    node: "规则范围提炼",
    body: "模型正在把快速输入和参考文本提炼成结构、语气、禁忌和检查点。",
    estimate: "通常 15-40 秒；期间可以继续编辑，但编辑后需要重新生成规则范围。",
  },
  precheck_normalization: {
    title: "正在运行生成前检查",
    node: "生成前检查",
    body: "模型正在把输入契约、输出契约和规则范围清洗成生成契约候选。",
    estimate: "通常 15-40 秒；重跑会生成新 trace，不覆盖旧 run。",
  },
  candidate_generation: {
    title: "正在生成候选",
    node: "候选生成",
    body: "模型正在按已确认检查、输出契约和规则快照生成候选正文，并写入 trace / eval scores。",
    estimate: "通常 30-90 秒；旧候选不会被改写。",
  },
  feedback_reasoning: {
    title: "正在记录反馈",
    node: "反馈分析",
    body: "模型正在根据选中文本、候选正文和标签归因反馈原因，再写入反馈账本。",
    estimate: "通常 10-40 秒；反馈会先进入待处理队列。",
  },
  rule_patch_compilation: {
    title: "正在编译规则草稿",
    node: "规则草稿编译",
    body: "模型正在把未处理反馈压缩成最多 5 条规则草稿。",
    estimate: "通常 10-40 秒；不会改写历史候选。",
  },
  generation_batch: {
    title: "正在运行下一批",
    node: "下一批生成",
    body: "系统正在应用规则草稿，生成新的规则快照，并调用模型生成候选批次。",
    estimate: "通常 30-90 秒；规则更新和重跑是解耦的。",
  },
};

const WORKBENCH_LAYOUT_STORAGE_KEY = "doc-marker.workbench.layout.v2";
const DEFAULT_WORKBENCH_LAYOUT: Record<string, number> = {
  "jobs-sidebar": 16,
  "workbench-center": 58,
  "job-inspector": 26,
};

function parseWorkbenchLayout(value: string | null) {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value);

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const layout = parsed as Record<string, unknown>;
      const hasExpectedPanels = ["jobs-sidebar", "workbench-center", "job-inspector"].every(
        (id) => typeof layout[id] === "number" && Number.isFinite(layout[id]) && layout[id] > 0,
      );

      if (hasExpectedPanels) {
        return layout as Record<string, number>;
      }
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function flowStageFromQuery(value: string | null): FlowStage | null {
  return value === "intake" || value === "precheck" || value === "review" || value === "finalize" ? value : null;
}

export default function WritingProductionPage() {
  return (
    <Suspense fallback={<WritingProductionLoading />}>
      <WritingProductionClient />
    </Suspense>
  );
}

function WritingProductionLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f6f2] text-sm text-zinc-500">
      正在加载工作台...
    </main>
  );
}

function WritingProductionClient() {
  const searchParams = useSearchParams();
  const requestedRunId = searchParams.get("runId");
  const requestedStage = flowStageFromQuery(searchParams.get("stage"));
  const requestedCandidateId = searchParams.get("candidateId");
  const runtimeAbortRef = useRef<AbortController | null>(null);
  const sidebarPanelRef = useRef<PanelImperativeHandle | null>(null);
  const inspectorPanelRef = useRef<PanelImperativeHandle | null>(null);
	const [spec, setSpec] = useState<JobSpec>(initialJobSpec);
	const [outputContract, setOutputContract] = useState<OutputContract>(initialOutputContract);
	const [quickIntake, setQuickIntake] = useState<QuickIntake>(initialQuickIntake);
	const [stage, setStage] = useState<FlowStage>("intake");
	const [activeSource, setActiveSource] = useState<SourceKey | null>(null);
  const [centerMode, setCenterMode] = useState<CenterMode>("editor");
  const [activeSection, setActiveSection] = useState<AppSection>("jobs");
  const [jobView, setJobView] = useState<JobView>("all");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(1280);
  const [compactOverlay, setCompactOverlay] = useState<"inspector" | null>(null);
	const [workbenchLayout, setWorkbenchLayout] = useState<Record<string, number> | undefined>(DEFAULT_WORKBENCH_LAYOUT);
	const [selectedSkillPackageId, setSelectedSkillPackageId] = useState(baselineSkillPackageOptions[0].id);
	const [selectedOutputTypeProfileId, setSelectedOutputTypeProfileId] = useState(outputTypeProfiles[0].id);
	const [ruleScope, setRuleScope] = useState<WritingRuleScopeRecord | null>(null);
  const [publishedRulePackages, setPublishedRulePackages] = useState<RulePackageRecord[]>([]);
  const [rulePackageDraft, setRulePackageDraft] = useState<RulePackageRecord | null>(null);
  const [rulePackageTask, setRulePackageTask] = useState<"draft" | "publish" | null>(null);
	const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
	const [finalizedCandidateId, setFinalizedCandidateId] = useState<string | null>(null);
	const [activeRun, setActiveRun] = useState<WritingRunRecord | null>(null);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [availableRuns, setAvailableRuns] = useState<WritingRunRecord[]>([]);
	const [runDirty, setRunDirty] = useState(false);
	const [hasLoadedLatestRun, setHasLoadedLatestRun] = useState(false);
	const [runtimeBusy, setRuntimeBusy] = useState(false);
	const [runtimeTask, setRuntimeTask] = useState<RuntimeTaskKind | null>(null);
	const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const skillPackageOptions = useMemo(
    () => [
      ...baselineSkillPackageOptions,
      ...publishedRulePackages.map(rulePackageToSkillPackageOption),
    ],
    [publishedRulePackages],
  );
	const selectedSkillPackage = skillPackageOptions.find((skill) => skill.id === selectedSkillPackageId) ?? skillPackageOptions[0];
	const isBaselinePackage = selectedSkillPackage.id === "baseline-no-package";
	const selectedRuleScope = isBaselinePackage ? "本次文本" : selectedSkillPackage.category;
	const displayDrafts = useMemo(
	  () => {
	    if (!activeRun?.candidates.length) {
	      return [];
	    }

	    const latestGenerationRun = activeRun.generationRuns?.at(-1);
	    if (!latestGenerationRun) {
	      return activeRun.candidates;
	    }

	    return activeRun.candidates.filter((candidate) =>
	      latestGenerationRun.candidateIds.includes(candidate.id),
	    );
	  },
	  [activeRun],
	);
	const latestGenerationRun = activeRun?.generationRuns?.at(-1) ?? null;
	const evalTotalByCandidateId = useMemo(
	  () =>
	    new Map(
	      (activeRun?.evalRun?.candidateResults ?? []).map((result) => [
	        result.candidateId,
	        result.total,
	      ]),
	    ),
	  [activeRun?.evalRun],
	);
	const bestDraftIndex = useMemo(
	  () => {
	    if (!displayDrafts.length) {
	      return 0;
	    }

	    return displayDrafts.reduce((bestIndex, draft, index) => {
	      const score = evalTotalByCandidateId.get(draft.id) ?? Number.NEGATIVE_INFINITY;
	      const bestScore = evalTotalByCandidateId.get(displayDrafts[bestIndex].id) ?? Number.NEGATIVE_INFINITY;
	      return score > bestScore ? index : bestIndex;
	    }, 0);
	  },
	  [displayDrafts, evalTotalByCandidateId],
	);
	const selectedDraftIndex = useMemo(
	  () => {
	    const explicitIndex = displayDrafts.findIndex((draft) => draft.id === selectedCandidateId);
	    return explicitIndex >= 0 ? explicitIndex : bestDraftIndex;
	  },
	  [bestDraftIndex, displayDrafts, selectedCandidateId],
	);
	const selectedDraft = displayDrafts[selectedDraftIndex] ?? displayDrafts[0] ?? null;
	const finalizedDraftIndex = useMemo(
	  () => {
	    const explicitIndex = displayDrafts.findIndex((draft) => draft.id === finalizedCandidateId);
	    return explicitIndex >= 0 ? explicitIndex : selectedDraftIndex;
	  },
	  [displayDrafts, finalizedCandidateId, selectedDraftIndex],
	);
	const finalizedDraft = displayDrafts[finalizedDraftIndex] ?? selectedDraft;
  const precheckTrace = useMemo(
    () =>
      (activeRun?.llmTraces ?? [])
        .slice()
        .reverse()
        .find((item) => item.nodeType === "precheck_normalization") ?? null,
    [activeRun],
  );
  const compactWorkbench = viewportWidth < 760;
  const autoCollapseAuxPanels = viewportWidth < 1180;
  const effectiveSidebarCollapsed = sidebarCollapsed || autoCollapseAuxPanels;
  const effectiveInspectorCollapsed = inspectorCollapsed || autoCollapseAuxPanels;

  useEffect(() => {
    const updateViewportWidth = () => setViewportWidth(window.innerWidth);

    setWorkbenchLayout(parseWorkbenchLayout(window.localStorage.getItem(WORKBENCH_LAYOUT_STORAGE_KEY)) ?? DEFAULT_WORKBENCH_LAYOUT);
    updateViewportWidth();
    window.addEventListener("resize", updateViewportWidth);

    return () => window.removeEventListener("resize", updateViewportWidth);
  }, []);

  useEffect(() => {
    if (!compactWorkbench) {
      setCompactOverlay(null);
    }
  }, [compactWorkbench]);

  useEffect(() => {
    if (effectiveSidebarCollapsed) {
      sidebarPanelRef.current?.collapse();
      return;
    }

    window.requestAnimationFrame(() => {
      sidebarPanelRef.current?.expand();
      window.requestAnimationFrame(() => sidebarPanelRef.current?.resize("18%"));
    });
  }, [effectiveSidebarCollapsed]);

  useEffect(() => {
    if (effectiveInspectorCollapsed) {
      inspectorPanelRef.current?.collapse();
      return;
    }

    window.requestAnimationFrame(() => {
      inspectorPanelRef.current?.expand();
      window.requestAnimationFrame(() => inspectorPanelRef.current?.resize("26%"));
    });
  }, [effectiveInspectorCollapsed]);

  function stageForRun(run: WritingRunRecord): FlowStage {
    if (run.status === "draft_scope_ready") {
      return "intake";
    }
    if (run.status === "finalized") {
      return "finalize";
    }

    return run.candidates.length > 0 ? "review" : "precheck";
  }

  function upsertAvailableRun(run: WritingRunRecord) {
    const displayRun = cleanLegacySeedRun(run);
    setAvailableRuns((current) => [
      displayRun,
      ...current.filter((item) => item.id !== displayRun.id),
    ]);
  }

  function syncActiveRun(run: WritingRunRecord) {
    const displayRun = cleanLegacySeedRun(run);
    setActiveRun(displayRun);
    upsertAvailableRun(displayRun);
    return displayRun;
  }

  function applyRun(run: WritingRunRecord, nextStage: FlowStage = stageForRun(run)) {
    const displayRun = cleanLegacySeedRun(run);
    setActiveRun(displayRun);
    setSpec(displayRun.jobSpec);
    setOutputContract(displayRun.outputContract ?? initialOutputContract);
    setSelectedOutputTypeProfileId(outputTypeProfileIdFor(displayRun.outputContract ?? initialOutputContract));
    setQuickIntake({
      raw: displayRun.quickIntake ?? "",
      referencePaste: displayRun.referencePaste ?? displayRun.ruleScope?.referencePaste ?? "",
    });
    setRuleScope(displayRun.ruleScope ?? null);
    setRulePackageDraft(displayRun.rulePackages?.find((item) => item.status === "draft") ?? null);
    setSelectedCandidateId(displayRun.finalizedCandidateId ?? null);
    setFinalizedCandidateId(displayRun.finalizedCandidateId ?? null);
    setRunDirty(false);
    setRuntimeError(null);
    setStage(nextStage);
  }

  function canVisitStage(nextStage: FlowStage) {
    if (runtimeBusy) {
      return false;
    }
    if (nextStage === "intake") {
      return true;
    }
    if (nextStage === "precheck") {
      return Boolean(activeRun || ruleScope);
    }
    if (nextStage === "review" || nextStage === "finalize") {
      return Boolean(activeRun?.candidates.length);
    }

    return false;
  }

  function visitStage(nextStage: FlowStage) {
    if (!canVisitStage(nextStage)) {
      return;
    }
    if (nextStage === "finalize") {
      enterFinalize();
      return;
    }

    setStage(nextStage);
    if (activeRun) {
      replaceRunUrl(activeRun.id, nextStage);
    }
  }

  function replaceRunUrl(runId: string, nextStage: FlowStage, candidateId?: string | null) {
    const params = new URLSearchParams({ runId, stage: nextStage });
    if (candidateId) {
      params.set("candidateId", candidateId);
    }
    window.history.replaceState(null, "", `/?${params.toString()}`);
  }

  function normalizeRequestedStage(run: WritingRunRecord, nextStage: FlowStage | null) {
    if (!nextStage) {
      return stageForRun(run);
    }
    if ((nextStage === "review" || nextStage === "finalize") && !run.candidates.length) {
      return stageForRun(run);
    }
    return nextStage;
  }

  useEffect(() => {
    if (hasLoadedLatestRun && !requestedRunId) {
      return;
    }

    if (hasLoadedLatestRun && activeRun?.id === requestedRunId) {
      const nextStage = normalizeRequestedStage(activeRun, requestedStage);
      if (stage !== nextStage) {
        setStage(nextStage);
      }
      if (expandedRunId !== activeRun.id) {
        setExpandedRunId(activeRun.id);
      }
      if (requestedCandidateId && selectedCandidateId !== requestedCandidateId) {
        const requestedCandidateExists = activeRun.candidates.some((candidate) => candidate.id === requestedCandidateId);
        if (requestedCandidateExists) {
          setSelectedCandidateId(requestedCandidateId);
          setFinalizedCandidateId((current) => current ?? requestedCandidateId);
        }
      }
      if (nextStage !== requestedStage) {
        replaceRunUrl(activeRun.id, nextStage, requestedCandidateId);
      }
      return;
    }

    let cancelled = false;

    async function loadLatestRun() {
      try {
        const [data, packageData] = await Promise.all([
          listWritingRuns(),
          listRulePackages(),
        ]);
        const targetRun = requestedRunId
          ? data.runs.find((run) => run.id === requestedRunId) ?? null
          : null;

        if (cancelled) {
          return;
        }

        setAvailableRuns(data.runs.map(cleanLegacySeedRun));
        setPublishedRulePackages(packageData.rulePackages);
        if (requestedRunId && targetRun) {
          const nextStage = normalizeRequestedStage(targetRun, requestedStage);
          const displayRun = cleanLegacySeedRun(targetRun);
          const requestedCandidateExists = requestedCandidateId
            ? displayRun.candidates.some((candidate) => candidate.id === requestedCandidateId)
            : false;
          applyRun(displayRun, nextStage);
          setExpandedRunId(displayRun.id);
          if (requestedCandidateExists && requestedCandidateId) {
            setSelectedCandidateId(requestedCandidateId);
            setFinalizedCandidateId((current) => current ?? requestedCandidateId);
          }
          if (nextStage !== requestedStage || (requestedCandidateId && !requestedCandidateExists)) {
            replaceRunUrl(displayRun.id, nextStage, requestedCandidateExists ? requestedCandidateId : null);
          }
          setCenterMode("editor");
        } else if (requestedRunId) {
          setActiveRun(null);
          setExpandedRunId(null);
          setSelectedCandidateId(null);
          setFinalizedCandidateId(null);
          setCenterMode("jobs");
          setRuntimeError(`找不到任务：${requestedRunId}`);
          window.history.replaceState(null, "", "/");
        } else {
          setActiveRun(null);
          setExpandedRunId(null);
          setCenterMode("jobs");
        }
      } catch (error) {
        if (!cancelled) {
          setRuntimeError(error instanceof Error ? error.message : "读取最近任务失败");
        }
      } finally {
        if (!cancelled) {
          setHasLoadedLatestRun(true);
        }
      }
    }

    void loadLatestRun();

    return () => {
      cancelled = true;
    };
  }, [activeRun?.id, hasLoadedLatestRun, requestedCandidateId, requestedRunId, requestedStage]);

	function enterFinalize() {
	  const candidate = selectedDraft ?? displayDrafts[bestDraftIndex] ?? null;
	  if (!candidate) {
	    return;
	  }

	  setFinalizedCandidateId(candidate.id);
	  setStage("finalize");
    if (activeRun) {
      replaceRunUrl(activeRun.id, "finalize", candidate.id);
    }
	}

  function selectReviewCandidate(candidateId: string) {
    setSelectedCandidateId(candidateId);
    if (activeRun) {
      replaceRunUrl(activeRun.id, stage, candidateId);
    }
  }

  function selectFinalizedCandidate(candidateId: string) {
    setFinalizedCandidateId(candidateId);
    setSelectedCandidateId(candidateId);
    if (activeRun) {
      replaceRunUrl(activeRun.id, "finalize", candidateId);
    }
  }

  function startNewJobDraft() {
    window.history.replaceState(null, "", "/");
    setActiveRun(null);
    setExpandedRunId(null);
    setRuleScope(null);
    setRulePackageDraft(null);
    setSpec(initialJobSpec);
    setOutputContract(initialOutputContract);
    setSelectedOutputTypeProfileId(outputTypeProfiles[0].id);
    setQuickIntake(initialQuickIntake);
    setSelectedCandidateId(null);
    setFinalizedCandidateId(null);
    setRunDirty(false);
    setRuntimeError(null);
    setStage("intake");
    setCenterMode("editor");
    setHasLoadedLatestRun(true);
  }

  const scoringChecks = useMemo<BaselineCheck[]>(
    () => [
      {
        title: "任务目标匹配",
        source: "目标",
        sourceKeys: ["intent"],
        method: "Eval-driven Development：把目标转成可比较标准。",
        detail: spec.goal || "目标缺失时无法判断任务是否完成。",
	        impact: "独立 eval 节点和人工评分表，用于判断候选是否跑偏。",
        iteration: "未来可按业务场景调整权重。",
      },
      {
        title: "格式契约匹配",
        source: "输出契约",
        sourceKeys: ["output"],
        method: "Format Compliance：把长度、结构和格式转成可检查标准。",
        detail: `${outputContract.lengthRange}；${outputContract.formatRules}`,
	        impact: "评分口径会检查候选是否满足交付物形态，而不只看写得好不好。",
        iteration: "未来可按文章、博客、口播稿、TTS handoff 模板调整权重。",
      },
      {
        title: "素材忠实度",
        source: "底稿",
        sourceKeys: ["evidence"],
        method: "Grounding Eval：检查候选是否忠于输入材料。",
        detail: spec.source || "底稿缺失时事实校验风险升高。",
	        impact: "事实漂移扣分，以及是否需要补充素材。",
        iteration: "未来可接入事实引用和相似度检查。",
      },
      {
        title: "写法一致性",
        source: "写法参考",
        sourceKeys: ["style"],
        method: "Few-shot / Reference Method Eval：评估结构和语气是否匹配。",
        detail: spec.writingReference || "没有写法参考时仅使用 baseline 写法。",
	        impact: "风格偏好分和写作规则候选更新。",
        iteration: "未来可由多篇样本文自动提炼风格维度。",
      },
      {
        title: "偏好约束",
        source: "评审偏好",
        sourceKeys: ["review"],
        method: "Human preference eval：把主观偏好显性化。",
        detail: spec.reviewPreference || "没有评审偏好时仅使用 baseline 评分。",
	        impact: "人工评分、偏好冲突提示和下一轮生成约束。",
        iteration: "未来可从历史打分自动学习评审偏好。",
      },
    ],
    [outputContract, spec],
  );

  function beginRuntimeTask(task: RuntimeTaskKind) {
    runtimeAbortRef.current?.abort();
    const controller = new AbortController();
    runtimeAbortRef.current = controller;
    setRuntimeBusy(true);
    setRuntimeTask(task);
    setRuntimeError(null);
    return controller.signal;
  }

  function switchRuntimeTask(task: RuntimeTaskKind) {
    setRuntimeTask(task);
  }

  function finishRuntimeTask(signal?: AbortSignal) {
    if (!signal || runtimeAbortRef.current?.signal === signal) {
      runtimeAbortRef.current = null;
      setRuntimeBusy(false);
      setRuntimeTask(null);
    }
  }

  function stopWaitingForRuntime() {
    runtimeAbortRef.current?.abort();
    runtimeAbortRef.current = null;
    setRuntimeBusy(false);
    setRuntimeTask(null);
    setRuntimeError("已停止等待当前模型调用。若服务端已开始处理，它可能仍会完成并写入历史 run；需要时重新运行即可。");
  }

  function isAbortError(error: unknown) {
    return error instanceof DOMException && error.name === "AbortError";
  }

  function updateQuickIntake(field: keyof QuickIntake, value: string) {
    setQuickIntake((current) => ({ ...current, [field]: value }));
    setRuleScope(null);
    setRunDirty(true);
  }

  function updateSpec(field: keyof JobSpec, value: string) {
    setSpec((current) => ({ ...current, [field]: value }));
    setRunDirty(true);
    setStage("precheck");
  }

  function updateOutputContract(field: keyof OutputContract, value: string) {
    setOutputContract((current) => ({ ...current, [field]: value }));
    setSelectedOutputTypeProfileId("custom");
    setRunDirty(true);
    setStage("precheck");
  }

  function selectOutputTypeProfile(profileId: string) {
    const profile = outputTypeProfiles.find((item) => item.id === profileId);
    if (!profile) {
      return;
    }

    setSelectedOutputTypeProfileId(profile.id);
    setOutputContract(profile.contract);
    setRunDirty(true);
    setStage("precheck");
  }

  function selectRuleSource(packageId: string) {
    const nextPackage = skillPackageOptions.find((item) => item.id === packageId);
    if (!nextPackage) {
      return;
    }

    setSelectedSkillPackageId(nextPackage.id);
    setRuleScope(null);
    setRunDirty(true);
    setStage("intake");
    setSpec((current) => ({
      ...current,
      writingReference: nextPackage.prefill.writingReference,
      reviewPreference: nextPackage.prefill.reviewPreference,
    }));
  }

  function currentSkillPackageSnapshot() {
    return {
      id: selectedSkillPackage.id,
      category: selectedSkillPackage.category,
      version: selectedSkillPackage.version,
      status: selectedSkillPackage.status,
      rulePackageId: selectedSkillPackage.rulePackage?.id,
      rules: selectedSkillPackage.rulePackage?.rules.map((rule) => rule.text),
      summary: selectedSkillPackage.rulePackage?.summary ?? selectedSkillPackage.description,
    };
  }

  async function deriveRuleScopeForIntake(signal?: AbortSignal) {
    const data = await deriveRuleScope({
      runId: activeRun?.status === "draft_scope_ready" ? activeRun.id : undefined,
      quickIntake: quickIntake.raw,
      referencePaste: quickIntake.referencePaste,
      skillPackage: currentSkillPackageSnapshot(),
      outputProfile,
      outputContract,
      jobSpec: spec,
    }, { signal });
    setRuleScope(data.ruleScope);
    const displayRun = syncActiveRun(data.run);
    setExpandedRunId(displayRun.id);
    setCenterMode("editor");
    setStage("intake");
    setRunDirty(false);
    return { ...data, run: displayRun };
  }

  function removeRuleScopeItem(itemId: string) {
    setRuleScope((current) =>
      current
        ? {
            ...current,
            items: current.items.filter((item) => item.id !== itemId),
          }
        : current,
    );
    setRunDirty(true);
  }

  async function generateRuleScopePreview() {
    const signal = beginRuntimeTask("scope_extraction");
    try {
      await deriveRuleScopeForIntake(signal);
    } catch (error) {
      if (!isAbortError(error)) {
        setRuntimeError(error instanceof Error ? error.message : "运行时异常");
      }
    } finally {
      finishRuntimeTask(signal);
    }
  }

  async function createRunForSpec(
    nextSpec: JobSpec,
    scopeOverride?: WritingRuleScopeRecord | null,
    signal?: AbortSignal,
    draftRunIdOverride?: string,
  ) {
    const confirmedScope = scopeOverride
      ? {
          ...scopeOverride,
          status: "confirmed" as const,
        }
      : null;
    const payload: CreateWritingRunInput = {
      draftRunId: draftRunIdOverride ?? (activeRun?.status === "draft_scope_ready" ? activeRun.id : undefined),
      quickIntake: quickIntake.raw,
      referencePaste: quickIntake.referencePaste,
      ruleScope: confirmedScope,
      skillPackage: {
        ...currentSkillPackageSnapshot(),
      },
      outputProfile,
      outputContract,
      jobSpec: nextSpec,
    };
    const data = await createWritingRunRecord(payload, { signal });
    const displayRun = syncActiveRun(data.run);
    setRunDirty(false);
    return displayRun;
  }

  function keepRunOpenAfterStateChange(run: WritingRunRecord, nextStage: FlowStage) {
    setJobView((current) => (current === "all" ? current : jobViewForRun(run)));
    setCenterMode("editor");
    setExpandedRunId(run.id);
    setStage(nextStage);
    replaceRunUrl(run.id, nextStage);
  }

  async function confirmPrecheck() {
    const signal = beginRuntimeTask(activeRun && !runDirty ? "candidate_generation" : "precheck_normalization");
    try {
      const sourceRun = activeRun && !runDirty ? activeRun : await createRunForSpec(spec, ruleScope, signal);
      switchRuntimeTask("candidate_generation");
      const data = await confirmWritingRun(sourceRun.id, { signal });
      const displayRun = syncActiveRun(data.run);
      setJobView((current) => (current === "all" ? current : jobViewForRun(displayRun)));
      setCenterMode("editor");
      setExpandedRunId(displayRun.id);
      setRunDirty(false);
      setStage("review");
      replaceRunUrl(displayRun.id, "review");
    } catch (error) {
      if (!isAbortError(error)) {
        setRuntimeError(error instanceof Error ? error.message : "运行时异常");
      }
    } finally {
      finishRuntimeTask(signal);
    }
  }

  async function rerunPrecheck() {
    const signal = beginRuntimeTask(ruleScope ? "precheck_normalization" : "scope_extraction");
    try {
      let activeScope = ruleScope;
      let draftRunId = activeRun?.status === "draft_scope_ready" ? activeRun.id : undefined;
      if (!activeScope) {
        const data = await deriveRuleScopeForIntake(signal);
        activeScope = data.ruleScope;
        draftRunId = data.run.id;
      }
      if (!activeScope.items.length) {
        setRuntimeError("写作规则范围为空，至少保留 1 条规则范围。");
        return;
      }
      switchRuntimeTask("precheck_normalization");
      const createdRun = await createRunForSpec(spec, activeScope, signal, draftRunId);
      keepRunOpenAfterStateChange(createdRun, "precheck");
    } catch (error) {
      if (!isAbortError(error)) {
        setRuntimeError(error instanceof Error ? error.message : "运行时异常");
      }
    } finally {
      finishRuntimeTask(signal);
    }
  }

  async function startJobSpec() {
    const signal = beginRuntimeTask(ruleScope ? "precheck_normalization" : "scope_extraction");
    try {
      const rawInput = quickIntake.raw.trim();
      let activeScope = ruleScope;
      let draftRunId = activeRun?.status === "draft_scope_ready" ? activeRun.id : undefined;
      if (!activeScope) {
        const data = await deriveRuleScopeForIntake(signal);
        activeScope = data.ruleScope;
        draftRunId = data.run.id;
      }
      if (!activeScope.items.length) {
        setRuntimeError("写作规则范围为空，至少保留 1 条规则范围。");
        return;
      }
      switchRuntimeTask("precheck_normalization");

      const titleDraft = titleFromQuickIntake(rawInput);
      const nextSpec = {
        ...spec,
        title: spec.title || titleDraft,
        goal: spec.goal,
        source: spec.source || rawInput,
        writingReference: selectedSkillPackage.prefill.writingReference || spec.writingReference,
        reviewPreference: selectedSkillPackage.prefill.reviewPreference || spec.reviewPreference,
      };

      setSpec(nextSpec);
      const createdRun = await createRunForSpec(nextSpec, activeScope, signal, draftRunId);
      keepRunOpenAfterStateChange(createdRun, "precheck");
    } catch (error) {
      if (!isAbortError(error)) {
        setRunDirty(true);
        setRuntimeError(error instanceof Error ? error.message : "运行时异常");
      }
    } finally {
      finishRuntimeTask(signal);
    }
  }

	async function recordFeedback(feedback: HumanFeedbackInput) {
	  if (!activeRun) {
	    setRuntimeError("没有可写入的任务");
	    return;
	  }

	  const signal = beginRuntimeTask("feedback_reasoning");
	  try {
	    const data = await recordWritingFeedback(activeRun.id, {
	        ...feedback,
	        note:
	          feedback.note ??
	          (feedback.kind === "selection"
	            ? "用户通过选中文本提交局部反馈。"
	            : "用户提交人工反馈，用于校准下一轮写作规则候选。"),
	      }, { signal });

	    if (feedback.kind === "selection") {
        switchRuntimeTask("rule_patch_compilation");
        const patchData = await compileWritingRulePatch(
          data.run.id,
          { candidateId: feedback.candidateId },
          { signal },
        );
		      const displayRun = syncActiveRun(patchData.run);
        setJobView((current) => (current === "all" ? current : jobViewForRun(displayRun)));
		      return;
		    }

		    const displayRun = syncActiveRun(data.run);
	      setJobView((current) => (current === "all" ? current : jobViewForRun(displayRun)));
	  } catch (error) {
      if (!isAbortError(error)) {
	      setRuntimeError(error instanceof Error ? error.message : "运行时异常");
      }
	  } finally {
	    finishRuntimeTask(signal);
	  }
	}

	async function deleteFeedback(feedbackId: string) {
	  if (!activeRun) {
	    setRuntimeError("没有可写入的任务");
	    return;
	  }

		  const signal = beginRuntimeTask("feedback_reasoning");
		  try {
		    const data = await deleteWritingFeedback(activeRun.id, feedbackId, { signal });
		    syncActiveRun(data.run);
	  } catch (error) {
      if (!isAbortError(error)) {
	      setRuntimeError(error instanceof Error ? error.message : "运行时异常");
      }
	  } finally {
	    finishRuntimeTask(signal);
	  }
	}

	async function runGenerationBatch() {
	  if (!activeRun) {
	    setRuntimeError("没有可运行的任务");
	    return;
	  }

		  const signal = beginRuntimeTask("generation_batch");
		  try {
		    const data = await runWritingGenerationBatch(activeRun.id, { candidateCount: 3 }, { signal });
		    const displayRun = syncActiveRun(data.run);
	      setJobView((current) => (current === "all" ? current : jobViewForRun(displayRun)));
        setExpandedRunId(displayRun.id);
		    setStage("review");
        replaceRunUrl(displayRun.id, "review");
	  } catch (error) {
      if (!isAbortError(error)) {
	      setRuntimeError(error instanceof Error ? error.message : "运行时异常");
      }
	  } finally {
	    finishRuntimeTask(signal);
	  }
	}

	async function exportFinalizedDoc(candidate: CandidateRecord) {
	  const html = buildCandidateDocHtml({
	    candidate,
	    jobSpec: spec,
	    outputContract,
	    runId: activeRun?.id ?? "local",
	  });
	  const blob = new Blob([html], { type: "application/msword;charset=utf-8" });
	  const url = URL.createObjectURL(blob);
	  const link = document.createElement("a");
	  link.href = url;
	  link.download = `${slugifyFileName(candidate.title)}.doc`;
	  document.body.appendChild(link);
	  link.click();
	  link.remove();
	  URL.revokeObjectURL(url);

    if (!activeRun) {
      return;
    }

    try {
      const data = await finalizeWritingRunRecord(activeRun.id, { candidateId: candidate.id });
      const displayRun = syncActiveRun(data.run);
      setFinalizedCandidateId(candidate.id);
      setSelectedCandidateId(candidate.id);
      setJobView((current) => (current === "all" ? current : jobViewForRun(displayRun)));
      replaceRunUrl(displayRun.id, "finalize", candidate.id);
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : "定稿状态写入失败");
    }
	}

  async function createRulePackageDraftForFinalize(candidate: CandidateRecord) {
    if (!activeRun) {
      setRuntimeError("没有可沉淀规则包的任务");
      return;
    }

    setRulePackageTask("draft");
    setRuntimeError(null);
    try {
      const data = await createRulePackageDraft(activeRun.id, { candidateId: candidate.id });
      const displayRun = syncActiveRun(data.run);
      setRulePackageDraft(data.rulePackage);
      setExpandedRunId(displayRun.id);
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : "规则包草稿生成失败");
    } finally {
      setRulePackageTask(null);
    }
  }

  async function publishRulePackageForFinalize(rulePackage: RulePackageRecord) {
    if (!activeRun) {
      setRuntimeError("没有可发布规则包的任务");
      return;
    }

    setRulePackageTask("publish");
    setRuntimeError(null);
    try {
      const data = await publishRulePackageDraft(activeRun.id, { packageId: rulePackage.id });
      const displayRun = syncActiveRun(data.run);
      setRulePackageDraft(data.rulePackage);
      setPublishedRulePackages((current) => [
        data.rulePackage,
        ...current.filter((item) => item.id !== data.rulePackage.id),
      ]);
      setExpandedRunId(displayRun.id);
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : "规则包发布失败");
    } finally {
      setRulePackageTask(null);
    }
  }

  const filteredRuns = useMemo(
    () => availableRuns.filter((run) => jobView === "all" || jobViewForRun(run) === jobView),
    [availableRuns, jobView],
  );
  const viewCounts = useMemo(
    () => ({
      all: availableRuns.length,
      drafts: availableRuns.filter((run) => jobViewForRun(run) === "drafts").length,
      precheck: availableRuns.filter((run) => jobViewForRun(run) === "precheck").length,
      reviewing: availableRuns.filter((run) => jobViewForRun(run) === "reviewing").length,
      feedback: availableRuns.filter((run) => jobViewForRun(run) === "feedback").length,
      finalized: availableRuns.filter((run) => jobViewForRun(run) === "finalized").length,
    }),
    [availableRuns],
  );

  function changeJobView(view: JobView) {
    setJobView(view);
    setExpandedRunId(null);
    if (compactWorkbench) {
      setCenterMode("jobs");
    }
  }

  function openAllJobsList() {
    window.history.replaceState(null, "", "/");
    setJobView("all");
    setActiveRun(null);
    setExpandedRunId(null);
    setSelectedCandidateId(null);
    setFinalizedCandidateId(null);
    setRuntimeError(null);
    setCenterMode("jobs");
  }

  function openCurrentJobList() {
    window.history.replaceState(null, "", "/");
    setActiveRun(null);
    setExpandedRunId(null);
    setSelectedCandidateId(null);
    setFinalizedCandidateId(null);
    setRuntimeError(null);
    setCenterMode("jobs");
  }

  function backToReviewStage() {
    setStage("review");
    if (activeRun) {
      setExpandedRunId(activeRun.id);
      replaceRunUrl(activeRun.id, "review", selectedCandidateId);
    }
  }

  function changeAppSection(section: AppSection) {
    setActiveSection(section);
    setCenterMode("jobs");
  }

  function openRun(run: WritingRunRecord = activeRun as WritingRunRecord) {
    if (!run) {
      return;
    }
    replaceRunUrl(run.id, stageForRun(run));
    applyRun(run);
    setCenterMode("editor");
  }

  function toggleRunDetails(run: WritingRunRecord) {
    if (expandedRunId === run.id) {
      setExpandedRunId(null);
      return;
    }

    const nextStage = run.id === activeRun?.id && canVisitStage(stage) ? stage : stageForRun(run);
    replaceRunUrl(run.id, nextStage);
    applyRun(run, nextStage);
    setExpandedRunId(run.id);
    setCenterMode("editor");
  }

  function switchEditorStage(nextStage: FlowStage) {
    setCenterMode("editor");
    if (activeRun) {
      setExpandedRunId(activeRun.id);
    }
    visitStage(nextStage);
  }

  function collapseSidebar() {
    setSidebarCollapsed(true);
  }

  function expandSidebar() {
    setSidebarCollapsed(false);
  }

  function collapseInspector() {
    setInspectorCollapsed(true);
  }

  function expandInspector() {
    setInspectorCollapsed(false);
  }

  function persistWorkbenchLayout(layout: Record<string, number>) {
    setWorkbenchLayout(layout);

    if (compactWorkbench || autoCollapseAuxPanels || effectiveSidebarCollapsed || effectiveInspectorCollapsed) {
      return;
    }

    window.localStorage.setItem(WORKBENCH_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  }

  function renderEditor() {
    return (
      <LinearEditor
        stage={stage}
        activeRun={activeRun}
        ruleScope={ruleScope}
        selectedSkillPackage={selectedSkillPackage}
        skillPackageOptions={skillPackageOptions}
        isBaselinePackage={isBaselinePackage}
        selectedRuleScope={selectedRuleScope}
        quickIntake={quickIntake}
        spec={spec}
        outputContract={outputContract}
        outputTypeProfiles={outputTypeProfiles}
        selectedOutputTypeProfileId={selectedOutputTypeProfileId}
        activeSource={activeSource}
        runtimeBusy={runtimeBusy}
        runtimeTask={runtimeTask}
        precheckTrace={precheckTrace}
        scoringChecks={scoringChecks}
        displayDrafts={displayDrafts}
        selectedDraft={selectedDraft}
        selectedDraftIndex={selectedDraftIndex}
        bestDraftIndex={bestDraftIndex}
        finalizedDraft={finalizedDraft}
        rulePackageDraft={rulePackageDraft}
        rulePackageTask={rulePackageTask}
        onUpdateQuickIntake={updateQuickIntake}
        onUpdateSpec={updateSpec}
        onUpdateOutputContract={updateOutputContract}
        onSelectOutputTypeProfile={selectOutputTypeProfile}
        onSelectRuleSource={selectRuleSource}
        onSetActiveSource={setActiveSource}
        onClearActiveSource={() => setActiveSource(null)}
        onRemoveRuleScopeItem={removeRuleScopeItem}
        onGenerateRuleScope={generateRuleScopePreview}
        onStartJobSpec={startJobSpec}
        onRerunPrecheck={rerunPrecheck}
        onConfirmPrecheck={confirmPrecheck}
        canVisitStage={canVisitStage}
        onVisitStage={visitStage}
        onSelectCandidate={selectReviewCandidate}
        onSelectFinalCandidate={selectFinalizedCandidate}
        onRecordFeedback={activeRun ? recordFeedback : undefined}
        onRunGenerationBatch={runGenerationBatch}
        onEnterFinalize={enterFinalize}
        onBackToReview={backToReviewStage}
        onExportDoc={exportFinalizedDoc}
        onCreateRulePackageDraft={createRulePackageDraftForFinalize}
        onPublishRulePackage={publishRulePackageForFinalize}
      />
    );
  }

  return (
    <main className="h-screen overflow-hidden bg-[#f6f5f1] text-zinc-950">
      <ResizablePanelGroup
        direction="horizontal"
        defaultLayout={workbenchLayout}
        onLayoutChanged={persistWorkbenchLayout}
        className="h-full min-h-0 overflow-hidden"
      >
        <ResizablePanel
          id="jobs-sidebar"
          panelRef={sidebarPanelRef}
          defaultSize="24%"
          minSize={effectiveSidebarCollapsed ? "56px" : "220px"}
          maxSize={effectiveSidebarCollapsed ? "56px" : "340px"}
          collapsedSize="56px"
          collapsible
          className="min-h-0"
        >
          {effectiveSidebarCollapsed ? (
            <LinearSidebarRail
              activeSection={activeSection}
              onChangeSection={changeAppSection}
              onNewJob={startNewJobDraft}
            />
          ) : (
            <LinearSidebar
              activeSection={activeSection}
              onChangeSection={changeAppSection}
              onNewJob={startNewJobDraft}
            />
          )}
        </ResizablePanel>

        {effectiveSidebarCollapsed ? null : <ResizableHandle withHandle />}

        <ResizablePanel
          id="workbench-center"
          defaultSize="50%"
          minSize={compactWorkbench ? "0px" : "520px"}
          className="min-h-0 min-w-0"
        >
        <section className="flex h-full min-h-0 min-w-0 flex-col border-x bg-white">
          <LinearTopBar
            centerMode={centerMode}
            jobView={jobView}
            activeRun={activeRun}
            sidebarCollapsed={effectiveSidebarCollapsed}
            inspectorCollapsed={effectiveInspectorCollapsed}
            showSidebarToggle={!compactWorkbench && !autoCollapseAuxPanels}
            sidebarToggleDisabled={autoCollapseAuxPanels}
            inspectorToggleDisabled={false}
            onToggleSidebar={sidebarCollapsed ? expandSidebar : collapseSidebar}
            onToggleInspector={
              compactWorkbench || autoCollapseAuxPanels
                ? () => setCompactOverlay("inspector")
                : inspectorCollapsed
                  ? expandInspector
                  : collapseInspector
            }
            onOpenAllJobs={openAllJobsList}
            onOpenJobList={openCurrentJobList}
            onOpenSettingsHref="/settings/llm"
          />

          {runtimeTask ? (
            <div className="border-b px-4 py-3">
              <RuntimeStatusPanel task={runtimeTask} onStopWaiting={stopWaitingForRuntime} />
            </div>
          ) : null}

          {runtimeError ? (
            <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950">
              {runtimeError}
            </div>
          ) : null}

          <div className="min-h-0 flex-1">
            {compactWorkbench && centerMode === "jobs" ? (
              <LinearJobList
                runs={filteredRuns}
                activeRunId={activeRun?.id ?? null}
                view={jobView}
                counts={viewCounts}
                onChangeView={changeJobView}
                onOpenRun={openRun}
              />
            ) : compactWorkbench ? (
              renderEditor()
            ) : centerMode === "editor" && !activeRun ? (
              renderEditor()
            ) : (
              <LinearJobList
                runs={filteredRuns}
                activeRunId={activeRun?.id ?? null}
                expandedRunId={expandedRunId}
                view={jobView}
                counts={viewCounts}
                onChangeView={changeJobView}
                onOpenRun={openRun}
                onToggleRun={toggleRunDetails}
                renderExpandedRun={(run) =>
                  activeRun?.id === run.id ? (
                    renderEditor()
                  ) : (
                    <div className="rounded-lg border bg-white p-4 text-sm text-muted-foreground">
                      正在加载任务详情。
                    </div>
                  )
                }
              />
            )}
          </div>
        </section>
        </ResizablePanel>

        {!compactWorkbench && !effectiveInspectorCollapsed ? <ResizableHandle withHandle /> : null}

        {!compactWorkbench ? (
          <ResizablePanel
            id="job-inspector"
            panelRef={inspectorPanelRef}
            defaultSize="26%"
            minSize={effectiveInspectorCollapsed ? "56px" : "300px"}
            maxSize={effectiveInspectorCollapsed ? "56px" : "520px"}
            collapsedSize="56px"
            collapsible
            className="min-h-0"
          >
            {effectiveInspectorCollapsed ? (
              <LinearInspectorRail onExpand={expandInspector} />
            ) : (
              <LinearInspector
                activeRun={activeRun}
                selectedDraft={selectedDraft}
                latestGenerationRunId={latestGenerationRun?.id}
                stage={stage}
                centerMode={centerMode}
                runtimeBusy={runtimeBusy}
                onOpenRun={() => activeRun && openRun(activeRun)}
                onStageChange={switchEditorStage}
                onRunGenerationBatch={runGenerationBatch}
                onDeleteFeedback={deleteFeedback}
              />
            )}
          </ResizablePanel>
        ) : null}
      </ResizablePanelGroup>

      <Sheet
        open={Boolean(compactOverlay)}
        onOpenChange={(open) => {
          if (!open) {
            setCompactOverlay(null);
          }
        }}
      >
        <SheetContent
          side="right"
          className="w-[min(520px,100vw)] max-w-none overflow-hidden bg-[#fbfaf6] p-0 sm:max-w-none"
        >
          <SheetHeader className="border-b px-4 py-3 pr-12 text-left">
            <SheetTitle className="text-sm">上下文面板</SheetTitle>
            <SheetDescription className="truncate text-xs">
              {activeRun ? `${activeRun.jobSpec.title} · ${activeRun.id}` : "当前任务的摘要、下一步和 Trace。"}
            </SheetDescription>
          </SheetHeader>
          <LinearInspector
            activeRun={activeRun}
            selectedDraft={selectedDraft}
            latestGenerationRunId={latestGenerationRun?.id}
            stage={stage}
            centerMode={centerMode}
            runtimeBusy={runtimeBusy}
            onOpenRun={() => {
              if (activeRun) {
                openRun(activeRun);
              }
              setCompactOverlay(null);
            }}
            onStageChange={(nextStage) => {
              switchEditorStage(nextStage);
              setCompactOverlay(null);
            }}
            onRunGenerationBatch={runGenerationBatch}
            onDeleteFeedback={deleteFeedback}
          />
        </SheetContent>
      </Sheet>
    </main>
  );

}

function RuleScopePreview({
  ruleScope,
  onRemoveItem,
}: {
  ruleScope: WritingRuleScopeRecord | null;
  onRemoveItem: (itemId: string) => void;
}) {
  if (!ruleScope) {
    return (
      <section className="rounded-lg border border-dashed bg-zinc-50 p-4 text-sm text-muted-foreground">
        <div className="mb-2 flex flex-wrap gap-2">
          <SourceBadge label="Flow Baseline" tone="zinc" />
          <SourceBadge label="User Input" tone="blue" />
	        </div>
	        写作规则范围尚未生成。无模板时由 LLM 从用户输入和参考文本中拆出；选择模板时直接加载模板规则，不调用 Rule Scope LLM。
	      </section>
	    );
	  }

  const visibleLimit = ruleScope.items.length > 6 ? 6 : ruleScope.items.length;
  const visibleItems = ruleScope.items.slice(0, visibleLimit);
	  const hiddenItems = ruleScope.items.slice(visibleLimit);
	  const sourceLabel = ruleScopeSourceLabel[ruleScope.source];
  const templateScope = ruleScope.source === "template";

	  return (
	    <section className="space-y-3 rounded-lg border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
	          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
	            写作规则范围
	            <SourceBadge label={templateScope ? "Template Rule / 模板复用" : "LLM Generated / 模型生成"} tone={templateScope ? "violet" : "amber"} />
	            <SourceBadge label="Editable Rule" tone="violet" />
	            <SourceBadge label="Saved Draft" tone="emerald" />
	          </div>
	          <p className="mt-1 text-sm text-muted-foreground">
	            {templateScope ? "已加载" : "LLM 已拆出"} {ruleScope.items.length} 条临时规则，已保存为 Draft Job；提炼评分：{ruleScope.eval.score} / 100；来源：{sourceLabel}。
	          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border bg-zinc-50 px-2 py-1 font-mono [overflow-wrap:anywhere]">
              {ruleScope.llmTrace.provider} / {ruleScope.llmTrace.model}
            </span>
            <span className="rounded-full border bg-zinc-50 px-2 py-1 font-mono [overflow-wrap:anywhere]">
              {ruleScope.llmTrace.promptVersion}
            </span>
            <span className="rounded-full border bg-zinc-50 px-2 py-1 font-mono [overflow-wrap:anywhere]">
              trace {ruleScope.llmTrace.id}
            </span>
            {typeof ruleScope.llmTrace.latencyMs === "number" ? (
              <span className="rounded-full border bg-zinc-50 px-2 py-1 font-mono">
                {ruleScope.llmTrace.latencyMs}ms
              </span>
            ) : null}
          </div>
        </div>
        <Badge variant="outline">{ruleScope.status}</Badge>
      </div>
	      <WarningCallout title={templateScope ? "模板复用提示" : "LLM 生成提示"}>{ruleScope.warning}</WarningCallout>
	      <div className="grid gap-2">
	        {visibleItems.map((item) => (
	          <div key={item.id} className={cn("rounded-lg border p-3", templateScope ? "border-violet-100 bg-violet-50/40" : "border-amber-100 bg-amber-50/40")}>
	            <div className="flex items-start justify-between gap-3">
	              <div className="min-w-0">
	                <div className="flex flex-wrap items-center gap-2">
	                  <SourceBadge label={templateScope ? "Template Rule" : "LLM Generated"} tone={templateScope ? "violet" : "amber"} />
                  <Badge variant="secondary">{scopeKindLabel[item.kind]}</Badge>
                  <Badge variant="outline">{confidenceLabel[item.confidence]}</Badge>
                  <SourceBadge label="可删除" tone="violet" />
                </div>
                <p className="mt-2 text-sm text-zinc-900">{item.text}</p>
                <details className="mt-1 text-xs text-muted-foreground">
                  <summary className="cursor-pointer">来源说明</summary>
                  <p className="mt-1">{item.sourceNote}</p>
                </details>
              </div>
              <Button
                aria-label="删除 scope 项"
                size="icon"
                variant="ghost"
                onClick={() => onRemoveItem(item.id)}
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      {hiddenItems.length ? (
        <details className="rounded-lg border border-dashed bg-zinc-50 p-3 text-sm">
          <summary className="cursor-pointer font-medium text-muted-foreground">
            其余 {hiddenItems.length} 条已折叠
          </summary>
          <div className="mt-3 grid gap-2">
	            {hiddenItems.map((item) => (
	              <div key={item.id} className="flex items-start justify-between gap-3 rounded-md border bg-white p-2">
	                <div className="min-w-0">
	                  <div className="flex flex-wrap items-center gap-2">
	                    <SourceBadge label={templateScope ? "Template Rule" : "LLM Generated"} tone={templateScope ? "violet" : "amber"} />
                    <Badge variant="secondary">{scopeKindLabel[item.kind]}</Badge>
                    <Badge variant="outline">{confidenceLabel[item.confidence]}</Badge>
                    <SourceBadge label="可删除" tone="violet" />
                  </div>
                  <p className="mt-1 text-sm text-zinc-900">{item.text}</p>
                </div>
                <Button
                  aria-label="删除 scope 项"
                  size="icon"
                  variant="ghost"
                  onClick={() => onRemoveItem(item.id)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </details>
      ) : null}
      <div className="grid gap-2 md:grid-cols-3">
        {ruleScope.eval.checks.map((check) => (
          <div key={check.label} className="rounded-lg border bg-zinc-50 p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{check.label}</span>
              <Badge variant={check.status === "pass" ? "secondary" : "outline"}>{check.status}</Badge>
            </div>
            <p className="mt-2 text-muted-foreground">{check.guidance}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function RuntimeStatusPanel({
  task,
  onStopWaiting,
}: {
  task: RuntimeTaskKind;
  onStopWaiting: () => void;
}) {
  const copy = runtimeTaskCopy[task];

  return (
    <section className="rounded-lg border-2 border-zinc-900 bg-white p-4 text-sm shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Loader2 className="size-3 animate-spin" />
              running
            </Badge>
            <Badge variant="outline" className="font-mono">
              {copy.node}
            </Badge>
          </div>
          <div className="mt-2 font-semibold">{copy.title}</div>
          <p className="mt-1 text-muted-foreground">{copy.body}</p>
          <p className="mt-1 text-xs text-amber-700">{copy.estimate}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onStopWaiting}>
          停止等待
        </Button>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-100">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-zinc-900" />
      </div>
    </section>
  );
}

const editorStageSteps: Array<{ id: FlowStage; label: string; hint: string }> = [
  { id: "intake", label: "输入", hint: "开始" },
  { id: "precheck", label: "检查", hint: "契约" },
  { id: "review", label: "评审", hint: "候选" },
  { id: "finalize", label: "定稿", hint: "导出" },
];

function StagePath({
  stage,
  canVisitStage,
  onVisitStage,
}: {
  stage: FlowStage;
  canVisitStage: (stage: FlowStage) => boolean;
  onVisitStage: (stage: FlowStage) => void;
}) {
  return (
    <nav className="rounded-lg border bg-white px-3 py-2" aria-label="文本生产流程">
      <div className="flex flex-wrap items-center gap-2">
        {editorStageSteps.map((step, index) => {
          const active = step.id === stage;
          const enabled = canVisitStage(step.id);

          return (
            <div key={step.id} className="flex items-center gap-2">
              {index > 0 ? <span className="text-xs text-muted-foreground">/</span> : null}
              <button
                type="button"
                disabled={!enabled}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-left text-xs transition disabled:cursor-not-allowed disabled:opacity-40",
                  active
                    ? "bg-zinc-950 text-white"
                    : "text-muted-foreground hover:bg-zinc-100 hover:text-zinc-950",
                )}
                onClick={() => onVisitStage(step.id)}
              >
                <span className="font-medium">{step.label}</span>
                <span className="ml-1 opacity-75">{step.hint}</span>
                {active ? (
                  <span className="ml-2 rounded-full border border-white/25 bg-white/15 px-1.5 py-0.5 text-[10px] font-medium">
                    流程预设
                  </span>
                ) : null}
              </button>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 border-t pt-2 text-xs text-muted-foreground">
        <SourceBadge label="Flow Baseline / 流程预设" tone="zinc" />
        <SourceBadge label="User Input / 用户输入" tone="blue" />
        <SourceBadge label="LLM Generated / 模型生成" tone="amber" />
        <span>导航节点是固定流程；具体字段和检查结果按来源标签区分。</span>
      </div>
    </nav>
  );
}

function LinearEditor({
  stage,
  activeRun,
  ruleScope,
  selectedSkillPackage,
  skillPackageOptions,
  isBaselinePackage,
  selectedRuleScope,
  quickIntake,
  spec,
  outputContract,
  outputTypeProfiles,
  selectedOutputTypeProfileId,
  activeSource,
  runtimeBusy,
  runtimeTask,
  precheckTrace,
  scoringChecks,
  displayDrafts,
  selectedDraft,
  selectedDraftIndex,
  bestDraftIndex,
  finalizedDraft,
  rulePackageDraft,
  rulePackageTask,
  onUpdateQuickIntake,
  onUpdateSpec,
  onUpdateOutputContract,
  onSelectOutputTypeProfile,
  onSelectRuleSource,
  onSetActiveSource,
  onClearActiveSource,
  onRemoveRuleScopeItem,
  onGenerateRuleScope,
  onStartJobSpec,
  onRerunPrecheck,
  onConfirmPrecheck,
  canVisitStage,
  onVisitStage,
  onSelectCandidate,
  onSelectFinalCandidate,
  onRecordFeedback,
  onRunGenerationBatch,
  onEnterFinalize,
  onBackToReview,
  onExportDoc,
  onCreateRulePackageDraft,
  onPublishRulePackage,
}: {
  stage: FlowStage;
  activeRun: WritingRunRecord | null;
  ruleScope: WritingRuleScopeRecord | null;
  selectedSkillPackage: SkillPackageOption;
  skillPackageOptions: SkillPackageOption[];
  isBaselinePackage: boolean;
  selectedRuleScope: string;
  quickIntake: QuickIntake;
  spec: JobSpec;
  outputContract: OutputContract;
  outputTypeProfiles: OutputTypeProfile[];
  selectedOutputTypeProfileId: string;
  activeSource: SourceKey | null;
  runtimeBusy: boolean;
  runtimeTask: RuntimeTaskKind | null;
  precheckTrace: LLMCallTraceRecord | null;
  scoringChecks: BaselineCheck[];
  displayDrafts: CandidateRecord[];
  selectedDraft: CandidateRecord | null;
  selectedDraftIndex: number;
  bestDraftIndex: number;
  finalizedDraft: CandidateRecord | null;
  rulePackageDraft: RulePackageRecord | null;
  rulePackageTask: "draft" | "publish" | null;
  onUpdateQuickIntake: (field: keyof QuickIntake, value: string) => void;
  onUpdateSpec: (field: keyof JobSpec, value: string) => void;
  onUpdateOutputContract: (field: keyof OutputContract, value: string) => void;
  onSelectOutputTypeProfile: (profileId: string) => void;
  onSelectRuleSource: (packageId: string) => void;
  onSetActiveSource: (source: SourceKey) => void;
  onClearActiveSource: () => void;
  onRemoveRuleScopeItem: (itemId: string) => void;
  onGenerateRuleScope: () => void;
  onStartJobSpec: () => void;
  onRerunPrecheck: () => void;
  onConfirmPrecheck: () => void;
  canVisitStage: (stage: FlowStage) => boolean;
  onVisitStage: (stage: FlowStage) => void;
  onSelectCandidate: (candidateId: string) => void;
  onSelectFinalCandidate: (candidateId: string) => void;
  onRecordFeedback?: (feedback: HumanFeedbackInput) => Promise<void> | void;
  onRunGenerationBatch: () => Promise<void> | void;
  onEnterFinalize: () => void;
  onBackToReview: () => void;
  onExportDoc: (candidate: CandidateRecord) => Promise<void> | void;
  onCreateRulePackageDraft: (candidate: CandidateRecord) => Promise<void> | void;
  onPublishRulePackage: (rulePackage: RulePackageRecord) => Promise<void> | void;
}) {
  const [precheckTab, setPrecheckTab] = useState("precheck");
  const quickTitle = titleFromQuickIntake(quickIntake.raw);
  const titleBadge =
    spec.title && quickTitle && spec.title === quickTitle ? (
      <SourceBadge label="System Derived / 从原始输入提取" tone="zinc" />
    ) : spec.title ? (
      <SourceBadge label="User Input / 用户确认" tone="blue" />
    ) : null;
  const sourceBadge =
    spec.source && spec.source.trim() === quickIntake.raw.trim() ? (
      <SourceBadge label="User Input Copy / 从原始输入复制" tone="blue" />
    ) : spec.source ? (
      <SourceBadge label="User Input / 用户确认" tone="blue" />
    ) : null;

  if (stage === "intake") {
    return (
      <EditorStageShell stage={stage} canVisitStage={canVisitStage} onVisitStage={onVisitStage}>
        <section className="flex min-h-[720px] flex-col rounded-lg border bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Draft Job 草稿</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                先保存输入和规则范围，再确认进入生成前检查。
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <SourceBadge label="Flow Baseline：流程固定" tone="zinc" />
                <SourceBadge label="User Input：你填写" tone="blue" />
                <SourceBadge label="LLM Generated：模型拆分" tone="amber" />
              </div>
            </div>
            <Badge variant="outline">{isBaselinePackage ? "Auto / 未套用类型" : selectedSkillPackage.category}</Badge>
          </div>
          <div className="mt-4 flex flex-1 flex-col gap-3">
            <Field label="规则来源">
              <select
                value={selectedSkillPackage.id}
                onChange={(event) => onSelectRuleSource(event.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {skillPackageOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.id === "baseline-no-package" ? "无模板：LLM 自动提炼规则" : `复用模板：${option.category}`}
                  </option>
                ))}
                {skillPackageOptions.length === 1 ? <option disabled>暂无已发布规则模板</option> : null}
              </select>
              <p className="text-xs leading-5 text-muted-foreground">
                无模板时调用 Rule Scope LLM 自动提炼；选择模板时只加载模板规则，不触发规则提炼 LLM。
              </p>
            </Field>
            <Textarea
              value={quickIntake.raw}
              onChange={(event) => onUpdateQuickIntake("raw", event.target.value)}
              className="min-h-32"
              placeholder="一句话想法、会议记录、视频转写、参考片段或底稿。"
            />
            <p className="-mt-2 text-xs text-blue-700">
              User Input：这部分完全来自你，系统不会把它当成固定规则。
            </p>
            <Textarea
              value={quickIntake.referencePaste}
              onChange={(event) => onUpdateQuickIntake("referencePaste", event.target.value)}
              className="min-h-24"
              placeholder="可选：粘贴参考文本。没有参考文本时只生成基线规则范围。"
            />
            <p className="-mt-2 text-xs text-blue-700">
              可选参考文本：用于提炼临时规则，不会直接发布为长期风格。
            </p>
            <RuleScopePreview ruleScope={ruleScope} onRemoveItem={onRemoveRuleScopeItem} />
            <div className="mt-auto flex items-center justify-end gap-2 border-t pt-3">
              <Button variant="outline" onClick={onGenerateRuleScope} disabled={runtimeBusy}>
                {runtimeTask === "scope_extraction"
                  ? isBaselinePackage
                    ? "规则提炼中..."
                    : "模板加载中..."
                  : isBaselinePackage
                    ? "生成规则范围"
                    : "加载模板规则"}
              </Button>
              <Button onClick={onStartJobSpec} disabled={runtimeBusy || (ruleScope?.items.length ?? 0) === 0}>
                确认规则范围并进入检查
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        </section>
      </EditorStageShell>
    );
  }

  if (stage === "precheck") {
    return (
      <EditorStageShell stage={stage} canVisitStage={canVisitStage} onVisitStage={onVisitStage}>
        <section className="grid min-h-[720px] gap-4 rounded-lg border bg-white p-4 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="flex min-w-0 flex-col gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold">输入契约</h2>
                <SourceBadge label="User Input / 用户输入" tone="blue" />
                <SourceBadge label="Flow Baseline / 字段结构" tone="zinc" />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                字段结构是系统预设；字段内容来自用户输入或上一步确认的规则范围。修改后需要重新运行生成前检查。
              </p>
            </div>
            <Field label="标题 / 任务" badge={titleBadge} sourceKey="intent" activeSource={activeSource} onActivate={onSetActiveSource} onClear={onClearActiveSource}>
              <Input value={spec.title} onChange={(event) => onUpdateSpec("title", event.target.value)} />
            </Field>
            <Field
              label="目标"
              badge={spec.goal ? <SourceBadge label="User Input / 用户确认" tone="blue" /> : null}
              sourceKey="intent"
              activeSource={activeSource}
              onActivate={onSetActiveSource}
              onClear={onClearActiveSource}
            >
              <Textarea
                value={spec.goal}
                onChange={(event) => onUpdateSpec("goal", event.target.value)}
                className="min-h-20"
                placeholder="未指定：右侧 Precheck LLM 会基于原始输入生成待确认建议，不回填本字段"
              />
            </Field>
            <Field label="底稿 / 原始素材" badge={sourceBadge} sourceKey="evidence" activeSource={activeSource} onActivate={onSetActiveSource} onClear={onClearActiveSource}>
              <Textarea value={spec.source} onChange={(event) => onUpdateSpec("source", event.target.value)} className="min-h-28" />
            </Field>
            <Field label="规则来源">
              <div className="flex flex-wrap gap-2">
                {isBaselinePackage ? (
                  <SourceBadge label="无模板：Rule Scope 由 LLM 生成" tone="amber" />
                ) : (
                  <SourceBadge label="模板复用：未调用 Rule Scope LLM" tone="violet" />
                )}
              </div>
              <select
                value={selectedSkillPackage.id}
                onChange={(event) => onSelectRuleSource(event.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {skillPackageOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.id === "baseline-no-package" ? "无模板：LLM 自动提炼规则" : `复用模板：${option.category}`}
                  </option>
                ))}
                {skillPackageOptions.length === 1 ? <option disabled>暂无已发布规则模板</option> : null}
              </select>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                规则来源互斥：无模板时由 LLM 自动生成 Draft Rule Scope；选择模板后不自动生成，只使用模板规则。
              </p>
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="产物类型" sourceKey="output" activeSource={activeSource} onActivate={onSetActiveSource} onClear={onClearActiveSource}>
                <Input
                  value={outputContract.artifactType}
                  onChange={(event) => onUpdateOutputContract("artifactType", event.target.value)}
                  placeholder="未指定：由右侧 Precheck LLM 给出待确认建议"
                />
              </Field>
              <Field label="长度范围" sourceKey="output" activeSource={activeSource} onActivate={onSetActiveSource} onClear={onClearActiveSource}>
                <Input
                  value={outputContract.lengthRange}
                  onChange={(event) => onUpdateOutputContract("lengthRange", event.target.value)}
                  placeholder="未指定：由右侧 Precheck LLM 给出待确认建议"
                />
              </Field>
            </div>
            <Field
              label="写法参考"
              badge={
                spec.writingReference ? (
                  isBaselinePackage ? (
                    <SourceBadge label="User Input / 用户确认" tone="blue" />
                  ) : (
                    <SourceBadge label="Template Rule / 模板规则" tone="violet" />
                  )
                ) : null
              }
              sourceKey="style"
              activeSource={activeSource}
              onActivate={onSetActiveSource}
              onClear={onClearActiveSource}
            >
              <Textarea
                value={spec.writingReference}
                onChange={(event) => onUpdateSpec("writingReference", event.target.value)}
                className="min-h-24"
                placeholder="未指定：无模板时不预设写法；由 Rule Scope / Precheck 生成待确认建议"
              />
            </Field>
            <Field label="评审偏好" sourceKey="review" activeSource={activeSource} onActivate={onSetActiveSource} onClear={onClearActiveSource}>
              <Textarea value={spec.reviewPreference} onChange={(event) => onUpdateSpec("reviewPreference", event.target.value)} className="min-h-24" />
            </Field>
          </div>

          <aside className="flex min-w-0 flex-col">
            <Tabs value={precheckTab} onValueChange={setPrecheckTab} className="min-h-0 flex flex-1 flex-col overflow-hidden rounded-lg border bg-white">
              <div className="border-b px-4 py-3">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="precheck">生成前检查</TabsTrigger>
                  <TabsTrigger value="ab">规则对照</TabsTrigger>
                  <TabsTrigger value="eval">评分口径</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="precheck" className="m-0 min-h-0 flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="p-4">
	                    <div className="flex items-start justify-between gap-3">
	                      <div>
	                        <div className="flex flex-wrap items-center gap-2">
	                          <h2 className="text-base font-semibold">生成前检查</h2>
                            <SourceBadge label="LLM Generated / 模型生成" tone="amber" />
                            <SourceBadge label="Flow Baseline / 检查结构" tone="zinc" />
                          </div>
	                        <p className="mt-1 text-sm text-muted-foreground">
                            检查结构是系统预设；内容摘要、依据边界、规则与风险由 LLM 根据输入契约生成。
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <SourceBadge label="Step 1 Rule Scope" tone={ruleScope?.source === "template" ? "violet" : "amber"} />
                            <span>+</span>
                            <SourceBadge label="Step 2 Precheck LLM" tone="amber" />
                            <span>右侧内容 = 左侧输入契约 + 已确认规则范围的二次归一结果。</span>
                          </div>
	                      </div>
	                      <Badge variant="outline">{precheckTrace ? `${precheckTrace.provider}` : "waiting"}</Badge>
	                    </div>
                    <WarningCallout>
                      {activeRun?.precheckRun.warning ?? "LLM 会按基线结构拆解输入；确认前不能进入生成。"}
                    </WarningCallout>
                    {activeRun ? (
                      <div className="mt-3 flex flex-col gap-3">
                          <div className="flex flex-wrap gap-2">
                            <SourceBadge label="以下内容：LLM Generated / 模型生成" tone="amber" />
                          </div>
	                        <InfoRow label="内容摘要" value={activeRun.precheckRun.contentBrief} />
	                        <InfoRow label="依据边界" value={activeRun.precheckRun.groundingBrief} />
                          <SourceCoveragePanel run={activeRun} ruleScope={ruleScope} />
	                        <details className="rounded-lg border bg-zinc-50 p-3 text-sm">
	                          <summary className="cursor-pointer font-medium">LLM 建议规则与风险</summary>
	                          <div className="mt-3 flex flex-col gap-2">
	                            {activeRun.precheckRun.writingRulesCandidate.slice(0, 5).map((rule, index) => (
	                              <div key={`${rule}-${index}`} className="rounded-md border border-amber-100 bg-amber-50/40 p-2">
                                  <SourceBadge label="Precheck LLM / 待确认" tone="amber" />
                                  <div className="mt-2">{rule}</div>
                                </div>
	                            ))}
	                          </div>
	                        </details>
                      </div>
                    ) : null}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="ab" className="m-0 min-h-0 flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                  <RuleScopeABPreview activeRun={activeRun} ruleScope={ruleScope} />
                </ScrollArea>
              </TabsContent>

              <TabsContent value="eval" className="m-0 min-h-0 flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="p-4">
                    <h3 className="text-sm font-semibold">评分口径</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      这里展示生成前的评分口径，不和检查内容混在一起。
                    </p>
                    <div className="mt-3 flex flex-col gap-2">
                      {scoringChecks.slice(0, 4).map((item) => (
                        <InfoRow key={item.title} label={item.title} value={item.impact} />
                      ))}
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
            <div className="mt-3 flex justify-end gap-2 rounded-lg border bg-white p-3">
              <Button variant="outline" size="sm" onClick={onRerunPrecheck} disabled={runtimeBusy}>
                重新运行
              </Button>
              <Button size="sm" onClick={onConfirmPrecheck} disabled={runtimeBusy}>
                生成候选
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </aside>
        </section>
      </EditorStageShell>
    );
  }

  if (stage === "review") {
    return (
      <EditorStageShell stage={stage} canVisitStage={canVisitStage} onVisitStage={onVisitStage}>
        <section className="min-h-[720px] rounded-lg border bg-white p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">候选评审</h2>
              <p className="mt-1 text-sm text-muted-foreground">卡片只导航，正文在阅读器中固定高度滚动。</p>
            </div>
            <Button size="sm" disabled={!selectedDraft} onClick={onEnterFinalize}>
              进入定稿
              <ArrowRight className="size-4" />
            </Button>
          </div>
          {activeRun ? (
            <ReviewNextActionBar
              run={activeRun}
              runtimeBusy={runtimeBusy}
              onRunGenerationBatch={onRunGenerationBatch}
            />
          ) : null}
          {selectedDraft ? (
            <CandidateWorkspace
              drafts={displayDrafts}
              selectedDraft={selectedDraft}
              selectedIndex={selectedDraftIndex}
              bestDraftIndex={bestDraftIndex}
              evalResults={activeRun?.evalRun?.candidateResults ?? []}
              feedback={activeRun?.feedback ?? []}
              onSelectCandidate={onSelectCandidate}
              onFeedback={onRecordFeedback}
              disabled={runtimeBusy}
            />
          ) : (
            <div className="rounded-lg border border-dashed bg-zinc-50 p-6 text-sm text-muted-foreground">
              当前任务还没有候选正文。
            </div>
          )}
        </section>
      </EditorStageShell>
    );
  }

  if (stage === "finalize" && activeRun && finalizedDraft) {
    return (
      <EditorStageShell stage={stage} canVisitStage={canVisitStage} onVisitStage={onVisitStage}>
        <section className="min-h-[720px] rounded-lg border bg-white p-4">
          <FinalizeExportPanel
            drafts={displayDrafts}
            selectedCandidateId={finalizedDraft.id}
            onSelectCandidate={onSelectFinalCandidate}
            onBack={onBackToReview}
            onExportDoc={onExportDoc}
            rulePackageDraft={rulePackageDraft}
            rulePackageTask={rulePackageTask}
            onCreateRulePackageDraft={onCreateRulePackageDraft}
            onPublishRulePackage={onPublishRulePackage}
          />
        </section>
      </EditorStageShell>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
      当前没有可编辑内容。
    </div>
  );
}

function EditorStageShell({
  stage,
  canVisitStage,
  onVisitStage,
  children,
}: {
  stage: FlowStage;
  canVisitStage: (stage: FlowStage) => boolean;
  onVisitStage: (stage: FlowStage) => void;
  children: ReactNode;
}) {
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-5">
        <StagePath stage={stage} canVisitStage={canVisitStage} onVisitStage={onVisitStage} />
        {children}
      </div>
    </ScrollArea>
  );
}

function RuleScopeABPreview({
  activeRun,
  ruleScope,
}: {
  activeRun: WritingRunRecord | null;
  ruleScope: WritingRuleScopeRecord | null;
}) {
  const columns = buildRuleScopeComparison({
    ruleScope,
    precheckRun: activeRun?.precheckRun,
  });

  return (
    <div className="flex flex-col gap-3 p-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">规则 A/B 对照</h3>
          <SourceBadge label="Derived Preview / 由当前任务派生" tone="zinc" />
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          这里不重新生成正文，只解释同一 Job Spec 下“是否应用 Rule Scope”会改变哪些生成约束和评分归因。
        </p>
      </div>

      <div className="grid gap-3">
        {columns.map((column) => (
          <section key={column.title} className="rounded-lg border bg-white p-3">
            <div className="flex items-start justify-between gap-3">
              <h4 className="text-sm font-semibold">{column.title}</h4>
              {column.badge}
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{column.summary}</p>
            <ul className="mt-3 space-y-2 text-xs leading-5">
              {column.bullets.map((bullet) => (
                <li key={bullet} className="flex gap-2 rounded-md border bg-zinc-50 px-2 py-2">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-zinc-500" />
                  <span className="min-w-0 break-words [overflow-wrap:anywhere]">{bullet}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <WarningCallout title="使用边界">
        A/B 对照用于判断规则是否值得进入本轮生成契约；真正的正文差异仍需要点击“生成候选”或运行下一批后在候选评审区比较。
      </WarningCallout>
    </div>
  );
}

function SourceCoveragePanel({
  run,
  ruleScope,
}: {
  run: WritingRunRecord;
  ruleScope: WritingRuleScopeRecord | null;
}) {
  const coverage = buildSourceCoverage(run, ruleScope);
  const imitationRisk =
    (run.referencePaste ?? ruleScope?.referencePaste ?? "").trim().length > 0
      ? "已提供参考文本：需要检查是否只抽象规则、没有复制句式。"
      : "未提供参考文本：过度仿写风险低，但专属风格覆盖不足。";

  return (
    <section className="rounded-lg border bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold">来源覆盖与发布风险</h4>
        <SourceBadge label="Risk Gate / 发布前检查" tone="zinc" />
      </div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        这里检查规则来源是否可追溯；高风险不会阻断生成候选，但会阻断沉淀为 Rule Package。
      </p>
      <div className="mt-3 grid gap-2">
        {coverage.map((item) => {
          const tone = item.status === "covered" ? "emerald" : item.status === "risk" ? "amber" : "zinc";
          const label = item.status === "covered" ? "covered" : item.status === "risk" ? "risk" : "missing";
          return (
            <div key={item.label} className="rounded-md border bg-zinc-50 p-2">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold">{item.label}</span>
                <SourceBadge label={label} tone={tone} />
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p>
            </div>
          );
        })}
      </div>
      <WarningCallout title="过度仿写检查">{imitationRisk}</WarningCallout>
    </section>
  );
}

function LinearInspector({
  activeRun,
  selectedDraft,
  latestGenerationRunId,
  stage,
  centerMode,
  runtimeBusy,
  onOpenRun,
  onStageChange,
  onRunGenerationBatch,
  onDeleteFeedback,
}: {
  activeRun: WritingRunRecord | null;
  selectedDraft: CandidateRecord | null;
  latestGenerationRunId?: string;
  stage: FlowStage;
  centerMode: CenterMode;
  runtimeBusy: boolean;
  onOpenRun: () => void;
  onStageChange: (stage: FlowStage) => void;
  onRunGenerationBatch: () => void;
  onDeleteFeedback: (feedbackId: string) => void;
}) {
  const [inspectorTab, setInspectorTab] = useState("summary");
  const traceCount = activeRun?.llmTraces?.length ?? 0;
  const langfuseTraceCount = activeRun?.llmTraces?.filter((trace) => trace.langfuseTraceId).length ?? 0;
  const fullPayloadCount =
    activeRun?.llmTraces?.filter((trace) => trace.inputPayload !== undefined && trace.outputPayload !== undefined).length ?? 0;
  const allTraces = (activeRun?.llmTraces ?? []).slice().reverse();
  const stageTraces = allTraces.filter((trace) => traceStage(trace.nodeType) === stage);
  const visibleTraces = (stageTraces.length ? stageTraces : allTraces).slice(0, 5);
  const traceScopeLabel = stageTraces.length ? stageCopy[stage].nextTitle : "全部调用";
  const ruleSourceLabel = activeRun?.ruleScope
    ? `${ruleScopeSourceLabel[activeRun.ruleScope.source]} / ${activeRun.ruleScope.items.length} 条`
    : "未生成";
  const hasRuleScope = Boolean(activeRun?.ruleScope?.items.length);
  const hasCandidates = Boolean(activeRun?.candidates.length);
  const hasUnprocessedFeedback = Boolean(activeRun?.feedback.some((item) => item.status === "unprocessed"));
  const nextAction =
    stage === "intake"
      ? {
          title: hasRuleScope ? "进入生成前检查" : "生成规则范围",
          reason: hasRuleScope
            ? "规则范围已生成，可以确认并进入检查。"
            : "当前任务还没有规则范围，先让模型从输入中拆出临时规则。",
          cta: "打开输入",
          target: "intake" as FlowStage,
        }
      : stage === "precheck"
        ? {
            title: hasCandidates ? "查看候选评审" : "生成候选",
            reason: hasCandidates
              ? "当前任务已有候选，下一步应进入评审。"
              : "检查契约已就绪，下一步生成候选文本。",
            cta: hasCandidates ? "打开评审" : "打开检查",
            target: hasCandidates ? ("review" as FlowStage) : ("precheck" as FlowStage),
          }
        : stage === "review"
          ? {
              title: hasUnprocessedFeedback ? "处理反馈队列" : "继续评审或进入定稿",
              reason: hasUnprocessedFeedback
                ? "已有未处理反馈，应先决定是否进入下一轮规则草稿。"
                : "当前没有未处理反馈，可以继续选择候选或进入定稿。",
              cta: "打开评审",
              target: "review" as FlowStage,
            }
          : {
              title: "导出定稿",
              reason: "已进入定稿阶段，确认候选后导出本次文本产物。",
              cta: "打开定稿",
              target: "finalize" as FlowStage,
            };

  return (
	    <aside className="flex h-full min-h-0 flex-col bg-[#fbfaf6]">
      <div className="border-b px-4 py-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">上下文面板</div>
          <div className="mt-1 truncate text-xs text-muted-foreground">
            {activeRun ? activeRun.id : "未选择任务"}
          </div>
        </div>
      </div>
      {!activeRun ? (
        <div className="p-4">
          <div className="rounded-lg border border-dashed bg-white p-4 text-sm text-muted-foreground">
            从列表选择一个任务，或新建任务。
          </div>
        </div>
      ) : centerMode === "jobs" ? (
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-4 p-4">
            <section className="rounded-lg border bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="line-clamp-2 text-sm font-semibold">{activeRun.jobSpec.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{runStateLabel(activeRun)}</div>
                </div>
                <Badge variant="outline">{activeRun.candidates.length} 个候选</Badge>
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                列表视图只负责选择任务；点击后工作区在当前页面打开，列表上下文不会丢失。
              </p>
              <Button className="mt-3 w-full" size="sm" onClick={onOpenRun}>
                打开工作区
              </Button>
            </section>
          </div>
        </ScrollArea>
      ) : (
        <Tabs value={inspectorTab} onValueChange={setInspectorTab} className="flex min-h-0 flex-1 flex-col">
          <div className="border-b px-3 py-2">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="summary">摘要</TabsTrigger>
              <TabsTrigger value="next">下一步</TabsTrigger>
              <TabsTrigger value="trace">Trace</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="summary" className="m-0 min-h-0 flex-1">
            <ScrollArea className="h-full">
              <div className="flex flex-col gap-3 p-4">
                <section className="rounded-lg border bg-white p-3">
                  <div className="line-clamp-2 text-sm font-semibold">{activeRun.jobSpec.title}</div>
                  <div className="mt-3 grid gap-2 text-xs">
                    <div className="flex items-center justify-between gap-3 rounded-md border bg-zinc-50 px-2 py-1.5">
                      <span className="text-muted-foreground">runId</span>
                      <span className="max-w-36 truncate font-mono">{activeRun.id}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-md border bg-zinc-50 px-2 py-1.5">
                      <span className="text-muted-foreground">状态</span>
                      <Badge variant="outline">{runStateLabel(activeRun)}</Badge>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-md border bg-zinc-50 px-2 py-1.5">
                      <span className="text-muted-foreground">阶段</span>
                      <Badge variant="secondary">{stageCopy[stage].nextTitle}</Badge>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-md border bg-zinc-50 px-2 py-1.5">
                      <span className="text-muted-foreground">候选</span>
                      <span>{activeRun.candidates.length} 个</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-md border bg-zinc-50 px-2 py-1.5">
                      <span className="text-muted-foreground">规则来源</span>
                      <span className="max-w-36 truncate">{ruleSourceLabel}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-md border bg-zinc-50 px-2 py-1.5">
                      <span className="text-muted-foreground">更新时间</span>
                      <span>{new Date(activeRun.updatedAt).toLocaleString("zh-CN")}</span>
                    </div>
                  </div>
                </section>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="next" className="m-0 min-h-0 flex-1">
            <ScrollArea className="h-full">
              <div className="flex flex-col gap-4 p-4">
                <section className="rounded-lg border bg-white p-3">
                  <div className="text-xs font-medium text-muted-foreground">推荐下一步</div>
                  <div className="mt-2 text-sm font-semibold">{nextAction.title}</div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{nextAction.reason}</p>
                  <Button className="mt-3 w-full" size="sm" disabled={runtimeBusy} onClick={() => onStageChange(nextAction.target)}>
                    {nextAction.cta}
                  </Button>
                </section>
                {stage === "review" && activeRun.feedback.some((item) => item.status === "unprocessed") ? (
                  <DecisionQueuePanel
                    run={activeRun}
                    latestGenerationRunId={latestGenerationRunId}
                    runtimeBusy={runtimeBusy}
                    disabled={runtimeBusy}
                    onRunGenerationBatch={onRunGenerationBatch}
                    onDeleteFeedback={onDeleteFeedback}
                  />
                ) : null}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="trace" className="m-0 min-h-0 flex-1">
            <ScrollArea className="h-full">
              <div className="flex flex-col gap-4 p-4">
                <details className="rounded-lg border bg-white p-3" open>
	                  <summary className="cursor-pointer list-none">
	                    <div className="flex items-start justify-between gap-3">
	                      <div>
	                        <div className="text-sm font-semibold">Trace 状态</div>
	                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
		                          默认只显示当前步骤相关调用；展开单条记录可看内置提示词、用户 payload 和模型输出预览。
		                        </p>
	                      </div>
	                      <Badge variant={traceCount > 0 ? "secondary" : "outline"}>{traceCount}</Badge>
                    </div>
                  </summary>
	                  <div className="mt-3 grid gap-2 text-xs">
	                    <div className="flex items-center justify-between rounded-md border bg-zinc-50 px-2 py-1.5">
	                      <span>当前范围</span>
	                      <Badge variant="outline">{traceScopeLabel}</Badge>
	                    </div>
	                    <div className="flex items-center justify-between rounded-md border bg-zinc-50 px-2 py-1.5">
	                      <span>本地 trace</span>
	                      <Badge variant="secondary">{traceCount} 条</Badge>
                    </div>
                    <div className="flex items-center justify-between rounded-md border bg-zinc-50 px-2 py-1.5">
                      <span>完整 payload</span>
                      <Badge variant="secondary">{fullPayloadCount} 条</Badge>
                    </div>
                    <div className="flex items-center justify-between rounded-md border bg-zinc-50 px-2 py-1.5">
                      <span>Langfuse 同步</span>
                      <Badge variant={langfuseTraceCount === traceCount && traceCount > 0 ? "secondary" : "outline"}>
                        {langfuseTraceCount}/{traceCount}
                      </Badge>
                    </div>
                  </div>
	                  <div className="mt-3 space-y-2">
		                    {visibleTraces.map((trace, index) => {
                        const inputSections = traceInputSections(trace);
                        const outputValue = traceOutputValue(trace);
                        const hasFullPayload = trace.inputPayload !== undefined && trace.outputPayload !== undefined;
                        const detailHref = frameworkDiagnosticsHref(activeRun, stage, selectedDraft, trace);

                        return (
                          <details
                            key={trace.id}
                            className="rounded-md border bg-zinc-50 text-xs open:bg-white"
                            open={index === 0}
                          >
                            <summary className="cursor-pointer list-none px-2 py-2">
                              <div className="flex items-start justify-between gap-2">
	                                <div className="min-w-0">
	                                  <div className="truncate font-medium">{traceStageLabel(trace.nodeType)} / {traceNodeLabel(trace.nodeType)}</div>
	                                  <div className="mt-1 truncate text-muted-foreground">
	                                    {trace.provider} / {trace.model}
	                                  </div>
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-1">
                                  <Badge variant={trace.status === "failed" ? "destructive" : "secondary"}>
                                    {trace.status === "failed" ? "失败" : "完成"}
                                  </Badge>
                                  {typeof trace.latencyMs === "number" ? (
                                    <span className="font-mono text-[11px] text-muted-foreground">{trace.latencyMs}ms</span>
                                  ) : null}
                                </div>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1">
                                <Badge variant={hasFullPayload ? "secondary" : "outline"}>
                                  {hasFullPayload ? "完整 payload" : "payload 缺失"}
                                </Badge>
                                {trace.langfuseTraceId ? <Badge variant="secondary">Langfuse</Badge> : <Badge variant="outline">本地</Badge>}
                                <Badge variant="outline" className="font-mono">{trace.promptVersion}</Badge>
                              </div>
                            </summary>
                            <div className="space-y-2 border-t px-2 py-2">
                              <section className="rounded-md border bg-white p-2">
                                <div className="mb-1 flex items-center justify-between gap-2">
                                  <span className="font-medium">系统内置提示词</span>
                                  <Badge variant="outline">Code Built-in</Badge>
                                </div>
                                <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded bg-zinc-950 p-2 font-mono text-[11px] leading-4 text-zinc-50">
                                  {formatTracePreview(inputSections.systemPrompt, 900)}
                                </pre>
                              </section>
                              <section className="rounded-md border bg-white p-2">
                                <div className="mb-1 flex items-center justify-between gap-2">
                                  <span className="font-medium">用户输入 / 组装 payload</span>
                                  <Badge variant="outline">Request</Badge>
                                </div>
                                <pre className="max-h-44 overflow-auto whitespace-pre-wrap rounded bg-zinc-950 p-2 font-mono text-[11px] leading-4 text-zinc-50">
                                  {formatTracePreview(inputSections.userPayload)}
                                </pre>
                              </section>
                              <section className="rounded-md border bg-white p-2">
                                <div className="mb-1 flex items-center justify-between gap-2">
                                  <span className="font-medium">模型输出</span>
                                  <Badge variant="outline">Response</Badge>
                                </div>
                                <pre className="max-h-44 overflow-auto whitespace-pre-wrap rounded bg-zinc-950 p-2 font-mono text-[11px] leading-4 text-zinc-50">
                                  {formatTracePreview(outputValue)}
                                </pre>
                              </section>
                              <Button asChild variant="outline" size="sm" className="w-full">
                                <Link href={detailHref}>打开完整观测详情</Link>
                              </Button>
                            </div>
                          </details>
                        );
                      })}
		                    {!visibleTraces.length ? (
		                      <div className="rounded-md border border-dashed bg-zinc-50 p-2 text-xs text-muted-foreground">
		                        当前步骤还没有模型调用。
	                      </div>
	                    ) : null}
                  </div>
                </details>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      )}
    </aside>
  );
}

function frameworkDiagnosticsHref(
  run: WritingRunRecord,
  stage: FlowStage,
  selectedDraft: CandidateRecord | null,
  trace?: LLMCallTraceRecord,
) {
  const params = new URLSearchParams({ runId: run.id });
  const returnParams = new URLSearchParams({ runId: run.id, stage });
  if (selectedDraft) {
    returnParams.set("candidateId", selectedDraft.id);
  }
  params.set("returnTo", `/?${returnParams.toString()}`);
  if (trace) {
    params.set("traceId", trace.id);
  }
  const nodes = run.frameworkRuns ?? [];
  let node: FrameworkNodeRunRecord | null = null;

  if (trace?.nodeRunId) {
    node = nodes.find((item) => item.id === trace.nodeRunId) ?? null;
  } else if (trace?.nodeType) {
    node = nodes.slice().reverse().find((item) => item.nodeType === trace.nodeType) ?? null;
  } else if (stage === "precheck") {
    node = nodes.slice().reverse().find((item) => item.nodeType === "precheck_normalization") ?? null;
  } else if (selectedDraft) {
    const generationRun = (run.generationRuns ?? []).find((item) =>
      item.candidateIds.includes(selectedDraft.id),
    );
    node =
      nodes
        .slice()
        .reverse()
        .find(
          (item) =>
            item.nodeType === "candidate_generation" &&
            (item.artifacts.some((artifact) => artifact.id === `candidate_artifacts_${run.id}_r${generationRun?.round}`) ||
              item.artifacts.some((artifact) => artifact.summary.includes(`第 ${generationRun?.round} 批`))),
        ) ?? null;

    params.set("candidateId", selectedDraft.id);
  } else {
    node = nodes.at(-1) ?? null;
  }

  if (node) {
    params.set("nodeRunId", node.id);
  }

  return `/framework?${params.toString()}`;
}

function traceNodeLabel(nodeType: string) {
  const labels: Record<string, string> = {
    scope_extraction: "Rule Scope 提炼",
    precheck_normalization: "Precheck 归一",
    candidate_generation: "候选生成",
    feedback_reasoning: "反馈分析",
    rule_patch_compilation: "规则草稿编译",
    generation_batch: "下一批生成",
    template_rule_scope_load: "模板规则加载",
  };

  return labels[nodeType] ?? nodeType;
}

function traceStage(nodeType: string): FlowStage {
  if (nodeType === "scope_extraction" || nodeType === "template_rule_scope_load") {
    return "intake";
  }
  if (nodeType === "precheck_normalization") {
    return "precheck";
  }
  if (
    nodeType === "candidate_generation" ||
    nodeType === "generation_batch" ||
    nodeType === "feedback_reasoning" ||
    nodeType === "rule_patch_compilation"
  ) {
    return "review";
  }

  return "finalize";
}

function traceStageLabel(nodeType: string) {
  return stageCopy[traceStage(nodeType)].nextTitle;
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function traceInputSections(trace: LLMCallTraceRecord) {
  const payload = trace.inputPayload as
    | {
        body?: {
          messages?: Array<{
            role?: string;
            content?: unknown;
          }>;
        };
      }
    | undefined;
  const messages = payload?.body?.messages ?? [];
  const systemPrompt = messages.find((message) => message.role === "system")?.content ?? null;
  const userPayload = messages.find((message) => message.role === "user")?.content ?? trace.inputPayload ?? null;

  return {
    systemPrompt,
    userPayload: parseMaybeJson(userPayload),
  };
}

function traceOutputValue(trace: LLMCallTraceRecord) {
  const payload = trace.outputPayload as
    | {
        normalizedOutput?: unknown;
        parsed?: unknown;
        content?: unknown;
        body?: {
          choices?: Array<{
            message?: {
              content?: unknown;
            };
          }>;
        };
      }
    | undefined;

  return (
    payload?.normalizedOutput ??
    payload?.parsed ??
    parseMaybeJson(payload?.content) ??
    parseMaybeJson(payload?.body?.choices?.[0]?.message?.content) ??
    trace.outputPayload ??
    null
  );
}

function formatTracePreview(value: unknown, maxLength = 1800) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  if (!text) {
    return "无 payload";
  }

  return text.length > maxLength ? `${text.slice(0, maxLength)}\n... 已截断，打开详情页查看完整 payload` : text;
}

function LinearInspectorRail({
  canExpand = true,
  onExpand,
}: {
  canExpand?: boolean;
  onExpand: () => void;
}) {
  return (
    <aside className="flex h-full min-h-0 flex-col items-center gap-3 bg-[#fbfaf6] px-2 py-3">
      {canExpand ? (
        <Button variant="ghost" size="icon" aria-label="展开上下文面板" onClick={onExpand}>
          <ChevronLeft className="size-4" />
        </Button>
      ) : null}
      <div className="mt-2 rotate-180 text-[11px] font-medium uppercase tracking-wide text-muted-foreground [writing-mode:vertical-rl]">
        上下文
      </div>
    </aside>
  );
}

function Field({
  label,
  children,
  badge,
  sourceKey,
  activeSource,
  onActivate,
  onClear,
}: {
  label: string;
  children: ReactNode;
  badge?: ReactNode;
  sourceKey?: SourceKey;
  activeSource?: SourceKey | null;
  onActivate?: (sourceKey: SourceKey) => void;
  onClear?: () => void;
}) {
  const active = sourceKey ? activeSource === sourceKey : false;

  return (
    <label
      className={cn(
        "block space-y-2 rounded-lg border border-transparent p-2 transition",
        active && "border-zinc-400 bg-zinc-50",
	      )}
	      onFocusCapture={() => sourceKey && onActivate?.(sourceKey)}
	      onBlurCapture={onClear}
	    >
	      <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {label}
          {badge}
        </span>
	      {children}
	    </label>
  );
}

function FinalizeExportPanel({
  drafts,
  selectedCandidateId,
  rulePackageDraft,
  rulePackageTask,
  onSelectCandidate,
  onBack,
  onExportDoc,
  onCreateRulePackageDraft,
  onPublishRulePackage,
}: {
  drafts: CandidateRecord[];
  selectedCandidateId: string;
  rulePackageDraft: RulePackageRecord | null;
  rulePackageTask: "draft" | "publish" | null;
  onSelectCandidate: (candidateId: string) => void;
  onBack: () => void;
  onExportDoc: (candidate: CandidateRecord) => Promise<void> | void;
  onCreateRulePackageDraft: (candidate: CandidateRecord) => Promise<void> | void;
  onPublishRulePackage: (rulePackage: RulePackageRecord) => Promise<void> | void;
}) {
  const selectedDraft = drafts.find((draft) => draft.id === selectedCandidateId) ?? drafts[0];
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    setCopyState("idle");
  }, [selectedDraft?.id]);

  async function copyPlainText() {
    if (!selectedDraft) {
      return;
    }

    const text = buildPlainTextExport(selectedDraft);
    try {
      await writeClipboardText(text);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1600);
    } catch {
      setCopyState("failed");
      window.setTimeout(() => setCopyState("idle"), 2200);
    }
  }

  return (
    <div className="text-zinc-950">
      <div className="border-b pb-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <StepMark active value="定稿" />
              定稿导出
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              只做最终选择和导出。这里不打反馈、不生成规则、不运行下一批。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onBack}>
              返回评审
            </Button>
            <Button variant="outline" size="sm" disabled={!selectedDraft} onClick={() => void copyPlainText()}>
              <Copy className="size-4" />
              {copyState === "copied" ? "已复制" : copyState === "failed" ? "复制失败" : "复制纯文本"}
            </Button>
            <Button
              size="sm"
              disabled={!selectedDraft}
              onClick={() => {
                if (selectedDraft) {
                  void onExportDoc(selectedDraft);
                }
              }}
            >
              <Download className="size-4" />
              导出本次 DOC
            </Button>
          </div>
        </div>
      </div>
      <div className="space-y-4 pt-4">
        <section className="rounded-lg border bg-zinc-50 p-3 text-sm">
          <div className="font-medium">定稿规则</div>
          <p className="mt-1 text-muted-foreground">
            当前只从本批候选中选择 1 个文本产物导出；TTS、视觉指导和 DOCX 排版是下游节点或导出包节点职责。
          </p>
        </section>

        <section className="rounded-lg border bg-white p-3 text-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 font-medium">
                规则包沉淀
                <SourceBadge label="Reusable Rule Package / 可复用" tone="violet" />
              </div>
              <p className="mt-1 text-muted-foreground">
                从本轮定稿候选、Rule Scope、Precheck 和人工反馈生成草稿；发布后可在新任务的规则来源中复用。
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!selectedDraft || Boolean(rulePackageTask)}
                onClick={() => selectedDraft && void onCreateRulePackageDraft(selectedDraft)}
              >
                {rulePackageTask === "draft" ? "生成中..." : rulePackageDraft ? "重新生成草稿" : "生成规则包草稿"}
              </Button>
              <Button
                size="sm"
                disabled={!rulePackageDraft || rulePackageDraft.status === "published" || Boolean(rulePackageTask)}
                onClick={() => rulePackageDraft && void onPublishRulePackage(rulePackageDraft)}
              >
                {rulePackageDraft?.status === "published"
                  ? "已发布"
                  : rulePackageTask === "publish"
                    ? "发布中..."
                    : "发布并允许复用"}
              </Button>
            </div>
          </div>
          {rulePackageDraft ? (
            <div className="mt-3 rounded-lg border bg-zinc-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-medium">{rulePackageDraft.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {rulePackageDraft.version} · {rulePackageDraft.rules.length} 条规则 · {rulePackageDraft.status === "published" ? "已发布" : "草稿"}
                  </div>
                </div>
                <Badge variant={rulePackageDraft.status === "published" ? "secondary" : "outline"}>
                  {rulePackageDraft.status === "published" ? "可复用" : "待发布"}
                </Badge>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {rulePackageDraft.rules.slice(0, 4).map((rule) => (
                  <div key={rule.id} className="rounded-md border bg-white px-3 py-2 text-xs leading-5 text-zinc-700">
                    <span className="font-medium text-zinc-950">{rulePackageSourceLabel(rule.source)}：</span>
                    {rule.text}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <div className="grid gap-4 lg:grid-cols-3">
          {drafts.map((draft) => {
            const active = draft.id === selectedDraft?.id;

            return (
              <button
                key={draft.id}
                type="button"
                className={cn(
                  "flex min-h-0 flex-col rounded-xl border-2 bg-white p-4 text-left shadow-sm transition",
                  active
                    ? "border-zinc-900 bg-zinc-50"
                    : "border-transparent ring-1 ring-inset ring-zinc-200 hover:border-zinc-400 hover:bg-zinc-50/50 hover:ring-transparent",
                )}
                onClick={() => onSelectCandidate(draft.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={active ? "secondary" : "outline"} className="font-mono">
                      {draft.version}
                    </Badge>
                    <SourceBadge label="LLM Generated / 模型生成" tone="amber" />
                  </div>
                  <Badge variant="outline">待确认</Badge>
                </div>
                <h3 className="mt-3 line-clamp-2 break-words text-base font-semibold [overflow-wrap:anywhere]">{draft.title}</h3>
                <p className="mt-2 line-clamp-3 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">{draft.summary}</p>
                <div className="mt-3 overflow-hidden rounded-lg border bg-white p-3">
                  <p className="line-clamp-3 break-words text-sm leading-5 text-zinc-800 [overflow-wrap:anywhere]">{draft.excerpt}</p>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{active ? "已选为本次定稿" : "点击选择"}</span>
                  <CheckCircle2 className={cn("size-4", active ? "text-zinc-900 opacity-100" : "text-zinc-300 opacity-0")} />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function buildPlainTextExport(candidate: CandidateRecord) {
  const title = stripMarkdownForPlainText(candidate.title).trim();
  const body = stripMarkdownForPlainText(candidate.excerpt).trim();
  if (!title) {
    return body;
  }
  if (!body || body.startsWith(title)) {
    return body || title;
  }
  return `${title}\n\n${body}`;
}

function rulePackageSourceLabel(source: RulePackageRecord["rules"][number]["source"]) {
  switch (source) {
    case "rule_scope":
      return "Scope";
    case "precheck":
      return "Precheck";
    case "feedback":
      return "Feedback";
    case "finalized_candidate":
      return "定稿";
    default:
      return "Rule";
  }
}

function stripMarkdownForPlainText(input: string) {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function writeClipboardText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!copied) {
    throw new Error("Clipboard copy failed");
  }
}

function ReviewNextActionBar({
  run,
  runtimeBusy,
  onRunGenerationBatch,
}: {
  run: WritingRunRecord;
  runtimeBusy: boolean;
  onRunGenerationBatch: () => Promise<void> | void;
}) {
  const draftPatches = run.rulePatches.filter((item) => item.status === "draft");
  const unprocessedFeedback = run.feedback.filter((item) => (item.status ?? "unprocessed") === "unprocessed");
  const compiledFeedback = run.feedback.filter((item) => item.status === "compiled");
  const hasDecisionWork = draftPatches.length > 0 || unprocessedFeedback.length > 0 || compiledFeedback.length > 0;

  if (!hasDecisionWork) {
    return (
      <section className="mb-4 min-h-[88px] rounded-lg border border-dashed bg-zinc-50 p-3 text-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">规则队列为空</span>
              <Badge variant="outline">0 条规则草稿</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              选中文本并打标签后，这里会出现下一批生成入口；旧候选不会被改写。
            </p>
          </div>
          <Button size="sm" variant="outline" disabled>
            等待反馈
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-4 min-h-[88px] rounded-lg border-2 border-zinc-900 bg-white p-3 text-sm shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">反馈已进入规则队列</span>
            <Badge variant={draftPatches.length ? "secondary" : "outline"}>
              {draftPatches.length} 条规则草稿
            </Badge>
            <Badge variant="outline">{compiledFeedback.length} 条反馈已编译</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            旧候选不改写；点击运行下一批后，系统才用当前规则快照生成新候选。
          </p>
        </div>
        <Button
          size="sm"
          disabled={runtimeBusy || draftPatches.length === 0}
          onClick={onRunGenerationBatch}
        >
          运行下一批
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </section>
  );
}

function CandidateWorkspace({
  drafts,
  selectedDraft,
  selectedIndex,
  bestDraftIndex,
  evalResults,
  feedback,
  onSelectCandidate,
  onFeedback,
  disabled,
}: {
  drafts: CandidateRecord[];
  selectedDraft: CandidateRecord;
  selectedIndex: number;
  bestDraftIndex: number;
  evalResults: NonNullable<WritingRunRecord["evalRun"]>["candidateResults"];
  feedback: HumanFeedbackRecord[];
  onSelectCandidate: (candidateId: string) => void;
  onFeedback?: (feedback: HumanFeedbackInput) => Promise<void> | void;
  disabled?: boolean;
}) {
  const [selectedQuote, setSelectedQuote] = useState("");
  const [selectionWasTruncated, setSelectionWasTruncated] = useState(false);
  const [readingTab, setReadingTab] = useState("body");
  const selectedFeedbacks = feedback.filter(
    (item) => item.candidateId === selectedDraft.id && item.kind === "selection",
  );
  const selectedEvalResult = evalResults.find((item) => item.candidateId === selectedDraft.id) ?? null;
  const evalScore = (dimension: string) =>
    selectedEvalResult?.attribution.find((item) => item.dimension === dimension)?.score ?? null;

  useEffect(() => {
    setSelectedQuote("");
    setSelectionWasTruncated(false);
  }, [selectedDraft.id]);

  function captureSelection() {
    const quote = window.getSelection()?.toString().trim().replace(/\s+/g, " ") ?? "";
    if (quote.length < 2) {
      return;
    }

    setReadingTab("body");
    setSelectionWasTruncated(quote.length > 180);
    setSelectedQuote(quote.slice(0, 180));
  }

  async function submitSelectionFeedback(verdict: SelectionFeedbackDraft["verdict"]) {
    const draftFeedback = analyzeSelectionFeedback(selectedDraft, selectedQuote, verdict);
    await onFeedback?.({
      kind: "selection",
      candidateId: selectedDraft.id,
      score: null,
      quote: draftFeedback.quote,
      verdict: draftFeedback.verdict,
      businessReason: draftFeedback.businessReason,
      likelyCause: draftFeedback.likelyCause,
      issue: draftFeedback.issue,
      expected: draftFeedback.expected,
      confidence: draftFeedback.confidence,
      note: `选中文本反馈：${draftFeedback.businessReason} / ${draftFeedback.issue}`,
    });
    window.getSelection()?.removeAllRanges();
    setSelectedQuote("");
    setSelectionWasTruncated(false);
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[230px_minmax(0,1fr)]">
      <aside className="rounded-xl border bg-zinc-50 p-3 lg:sticky lg:top-24 lg:self-start">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">版本导航</div>
            <p className="mt-1 text-xs text-muted-foreground">卡片只负责切换，不承载全文。</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <SourceBadge label="候选来自 LLM" tone="amber" />
            <Badge variant="outline">{drafts.length}</Badge>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {drafts.map((draft, index) => {
            const active = draft.id === selectedDraft.id;
            const selectionCount = feedback.filter(
              (item) => item.candidateId === draft.id && item.kind === "selection",
            ).length;

            return (
              <button
                key={draft.id}
                type="button"
                className={cn(
                  "w-full rounded-lg border bg-white p-3 text-left shadow-sm transition",
                  active
                    ? "border-2 border-zinc-900 bg-zinc-50 text-zinc-950 shadow-sm"
                    : "hover:border-zinc-400 hover:bg-white",
                )}
                onClick={() => {
                  setSelectedQuote("");
                  onSelectCandidate(draft.id);
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-zinc-700">
                    {draft.version || `V${index + 1}`}
                  </span>
                  <span className="text-xs text-muted-foreground">
	                    {index === bestDraftIndex ? "推荐" : "备选"}
                  </span>
                </div>
                <div className="mt-2 line-clamp-2 break-words text-sm font-medium text-zinc-950 [overflow-wrap:anywhere]">
                  {draft.title}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {index === bestDraftIndex ? (
                    <Badge
                      variant="secondary"
                      className={cn(active && "border border-zinc-300 bg-white text-zinc-900")}
                    >
	                      推荐
                    </Badge>
                  ) : null}
                  {selectionCount ? (
                    <Badge
                      variant="muted"
                      className={cn(active && "border border-zinc-300 bg-white text-zinc-700")}
                    >
                      {selectionCount} 反馈
                    </Badge>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <article className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="border-b bg-zinc-50/90 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="font-mono">
                  {selectedDraft.version || `版本 ${selectedIndex + 1}`}
                </Badge>
                {selectedIndex === bestDraftIndex ? <Badge variant="outline">当前推荐</Badge> : null}
                <Badge variant="outline">长文阅读器</Badge>
                <SourceBadge label="LLM Generated / 模型生成" tone="amber" />
              </div>
              <h3 className="mt-2 line-clamp-2 break-words text-lg font-semibold [overflow-wrap:anywhere]">{selectedDraft.title}</h3>
              <p className="mt-1 line-clamp-2 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">{selectedDraft.summary}</p>
            </div>
            <div className="flex min-w-32 items-center gap-2 rounded-lg border bg-white px-3 py-2 shadow-sm">
              <CheckCircle2 className="size-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-semibold">待人工确认</div>
                <div className="text-xs text-muted-foreground">模型自评已移入评分页</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 p-4">
          <section className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50/25">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                <BookOpenCheck className="size-4 text-amber-700" />
                阅读区
                <SourceBadge label="正文 / LLM Generated" tone="amber" />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="size-3.5 text-amber-600" />
                <span>无字数设置；正文独立滚动，选中片段后打标签。</span>
                {selectedFeedbacks.length ? (
                  <Badge variant="secondary">{selectedFeedbacks.length} 条反馈已记录</Badge>
                ) : null}
              </div>
            </div>
            <Tabs value={readingTab} onValueChange={setReadingTab} className="bg-white/80">
              <div className="border-b bg-white px-3 py-2">
                <TabsList className="grid w-full grid-cols-3 md:w-[420px]">
                  <TabsTrigger value="body">正文</TabsTrigger>
                  <TabsTrigger value="brief">摘要</TabsTrigger>
                  <TabsTrigger value="eval">评分</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="body" className="m-0">
                {selectedQuote ? (
                  <section className="border-b border-amber-200 bg-amber-50 p-3 text-sm shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold">选中文本反馈</div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          点一个标签即写入反馈账本，并自动生成规则草稿。
                          {selectionWasTruncated ? " 已截断到 180 字。" : ""}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0"
                        onClick={() => {
                          setSelectedQuote("");
                          setSelectionWasTruncated(false);
                        }}
                        aria-label="取消选中文本反馈"
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                    <blockquote className="mt-3 break-words rounded-lg border-l-4 border-amber-500 bg-white px-3 py-2 text-zinc-800 [overflow-wrap:anywhere]">
                      {selectedQuote}
                    </blockquote>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disabled || !onFeedback}
                        onClick={() => submitSelectionFeedback("revise")}
                      >
                        事实/任务不准
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disabled || !onFeedback}
                        onClick={() => submitSelectionFeedback("rejected")}
                      >
                        风格不对
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disabled || !onFeedback}
                        onClick={() => submitSelectionFeedback("rewrite")}
                      >
                        需要压缩
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disabled || !onFeedback}
                        onClick={() => submitSelectionFeedback("liked")}
                      >
                        喜欢这段
                      </Button>
                    </div>
                  </section>
                ) : null}
                <ScrollArea className="h-[min(62vh,760px)] bg-white/80">
                  <p
                    className="whitespace-pre-wrap break-words p-5 text-[15px] leading-8 text-zinc-900 selection:bg-amber-200 selection:text-zinc-950 [overflow-wrap:anywhere]"
                    onMouseUp={captureSelection}
                    onKeyUp={captureSelection}
                  >
                    {selectedDraft.excerpt}
                  </p>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="brief" className="m-0">
                <ScrollArea className="h-[min(62vh,760px)] bg-white/80">
                  <div className="grid gap-3 p-4 md:grid-cols-2">
                    <div className="rounded-lg border bg-zinc-50 p-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
                        Summary
                        <SourceBadge label="LLM Generated" tone="amber" />
                      </div>
                      <p className="mt-2 text-sm leading-6 text-zinc-900">{selectedDraft.summary}</p>
                    </div>
                    <div className="rounded-lg border bg-zinc-50 p-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
                        Rationale
                        <SourceBadge label="LLM Generated" tone="amber" />
                      </div>
                      <p className="mt-2 text-sm leading-6 text-zinc-900">{selectedDraft.rationale}</p>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 md:col-span-2">
                      <div className="flex items-center gap-2 text-xs font-medium text-amber-800">
                        <AlertTriangle className="size-4" />
                        Risk
                      </div>
                      <p className="mt-2 text-sm leading-6 text-amber-950">{selectedDraft.risk}</p>
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="eval" className="m-0">
                <ScrollArea className="h-[min(62vh,760px)] bg-zinc-50">
                  <div className="p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold">Eval 结果</div>
                      <Badge variant="outline" className="bg-white">独立评估节点</Badge>
                    </div>
                    <div className="grid gap-3 md:grid-cols-4">
                      <Score label="基础质量" source="candidate_eval" value={evalScore("基础质量")} />
                      <Score label="任务匹配" source="candidate_eval" value={evalScore("任务匹配")} />
                      <Score label="风格偏好" source="candidate_eval" value={evalScore("风格偏好")} />
                      <Score label="风险扣分" source="candidate_eval" value={evalScore("风险扣分")} danger />
                    </div>
                    <p className="mt-4 rounded-lg border bg-white px-3 py-2 text-xs leading-5 text-muted-foreground">
                      人工动作只保留“选中文本 + 打标签”。系统会自动归因并生成规则草稿，右侧反馈账本负责展示处理状态。
                    </p>
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </section>

        </div>
      </article>
    </section>
  );
}

function Score({
  label,
  source,
  value,
  danger,
}: {
  label: string;
  source: string;
  value: number | null;
  danger?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">{label}</div>
        <Badge variant="outline" className="bg-white text-[10px]">
          {source}
        </Badge>
      </div>
      <div className={cn("mt-1 text-lg font-semibold", danger && "text-destructive")}>
        {value === null ? "待评估" : value > 0 ? `+${value}` : value}
      </div>
    </div>
  );
}
