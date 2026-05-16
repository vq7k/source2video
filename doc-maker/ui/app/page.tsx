"use client";

import type { ComponentType, ReactNode } from "react";
import { useMemo, useState } from "react";

import {
	AlertTriangle,
	ArrowRight,
	BarChart3,
	BookOpenCheck,
	CheckCircle2,
	CircleHelp,
	CircleDot,
  Download,
	FileText,
  LockKeyhole,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  RULE_PATCH_DRAFT_LIMIT,
  RULE_SNAPSHOT_RULE_LIMIT,
} from "@/lib/writing-run-types";
import type {
  CandidateRecord,
  CreateWritingRunInput,
  HumanFeedbackInput,
  HumanFeedbackRecord,
  TextOutputContract,
  WritingJobSpec,
  WritingRunRecord,
} from "@/lib/writing-run-types";
import { cn } from "@/lib/utils";

type FlowStage = "context" | "precheck-ready" | "confirmed" | "finalize";

type JobSpec = WritingJobSpec;

type OutputContract = TextOutputContract;

type QuickIntake = {
  raw: string;
};

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

type SkillOption = {
  id: string;
  category: string;
  version: string;
  status: string;
  description: string;
  prefill: Pick<JobSpec, "writingReference" | "reviewPreference">;
};

const initialJobSpec: JobSpec = {
  title: "主管周会复盘：AI Agent 项目如何从框架转向产品闭环",
  goal:
    "写一篇给内部主管看的复盘文，目标是解释为什么从框架优先调整为文本生产闭环，并给出下一步决策建议。",
  source:
    "已有 UI mock、OpenSpec 讨论记录、业务侧原型反馈；材料中缺少明确的主管评分样本。",
  writingReference:
    "参考专业技术作者的结构：先给判断，再拆证据，最后给可执行下一步；外部写文章 skill 偏理性、低修辞、少口号。",
  reviewPreference:
    "主管审美不稳定。当前偏好：不要营销腔，不要泛泛谈 AI；标题克制，观点要可被追问。",
};

const initialQuickIntake: QuickIntake = {
  raw: "",
};

const outputProfile = {
  name: "structured explanation package",
  summary: "保留原“源材料 -> 结构化讲解文档包”设计，作为当前 Writing Job 的默认交付形态。",
  artifacts: ["plan", "scripts", "shots", "visual_spec", "qa_report"],
};

const initialOutputContract: OutputContract = {
  artifactType: "short explanatory text",
  lengthRange: "300-500 中文字（约 60-90 秒口播基准）",
  structure: "标题 + 判断开场 + 2-3 个短论证段 + 下一步",
  formatRules: "Markdown 正文；除非任务明确要求，不生成表格。",
  groundingRules: "每个关键判断必须能回指到底稿、用户输入或标注为待确认。",
  specialHandling: "不编造事实；不复制参考文句式；不确定内容标注低置信；复杂公式只标记为下游专项处理。",
  downstreamHandoff: "输出短 Text Artifact；TTS 目标 60-90 秒；Video 在下游节点独立处理。",
};

const skillOptions: SkillOption[] = [
  {
    id: "baseline-no-skill",
    category: "本次文本",
    version: "Baseline / No Skill selected",
    status: "baseline mode",
    description: "不套用历史类型，只根据本次 Quick Intake 和 Job Spec 生成临时 Writing Skill Candidate。",
    prefill: {
      writingReference: "",
      reviewPreference: "",
    },
  },
  {
    id: "exec-review",
    category: "主管复盘文",
    version: "主管复盘文 v0.3 candidate",
    status: "active candidate",
    description: "内部决策复盘写法，强调判断、证据和下一步。",
    prefill: {
      writingReference:
        "参考专业技术作者的结构：先给判断，再拆证据，最后给可执行下一步；外部写文章 skill 偏理性、低修辞、少口号。",
      reviewPreference:
        "主管审美不稳定。当前偏好：不要营销腔，不要泛泛谈 AI；标题克制，观点要可被追问。",
    },
  },
  {
    id: "video-script",
    category: "视频脚本文案",
    version: "视频脚本文案 v0.1 draft",
    status: "draft",
    description: "面向后续视频产物，强调脚本结构、镜头段落和发布反馈。",
    prefill: {
      writingReference:
        "参考专业视频脚本结构：先给 hook，再拆段落论证，每段保留可转镜头的画面提示；避免长段抽象概念。",
      reviewPreference:
        "优先判断是否能转成视频：开头是否有抓手，段落是否可剪辑，事实是否可视化，结尾是否有明确行动。",
    },
  },
  {
    id: "xiaohongshu-talk",
    category: "小红书口播稿",
    version: "小红书口播稿 frozen",
    status: "frozen",
    description: "历史偏移较大，当前不推荐作为新 Job 起点。",
    prefill: {
      writingReference:
        "历史口播样本只可参考节奏和信息密度，不复制句式；当前版本因偏移较大，默认不推荐继续开新主题。",
      reviewPreference:
        "重点检查是否过度口语化、是否制造夸张承诺、是否与业务事实脱节；低置信内容不能沉淀为 Skill。",
    },
  },
];

const autoFilledStack = [
  ["Job Spec schema", "渲染输入区字段：标题、目标、底稿、写法参考、评审偏好。"],
  ["Precheck schema", "初始化 Content Brief、Grounding Brief、Writing Rule Candidate、Risk Check。"],
  ["Eval Profile seed", "初始化基础质量、任务匹配、风格偏好、风险扣分和权重。"],
  ["Output Contract default", "默认 short explanatory text：300-500 中文字、60-90 秒口播基准、Markdown 格式和下游 handoff。"],
  ["Writing constraints", "带入结构、语气、禁止项、相似表达边界。"],
  ["Governance policy", "带入 low-confidence pass、Delayed Feedback、Retro Eval、Skill cleanup。"],
];

const governanceRules = [
  ["Low-confidence pass", "小偏移未被人工发现时，不直接沉淀为 Published Skill。"],
  ["Delayed Feedback", "视频发布后反馈可绑定历史 Job，追加到评分账本。"],
  ["Retro Eval", "审美变化或新经验出现后，用 Eval Profile v2 追加重评。"],
  ["Skill cleanup", "污染规则需要降权、冻结、废弃或回滚；历史评分不覆盖，只追加版本。"],
];

const methodologyReferences = [
  {
    name: "Creative Brief",
    role: "把目标、受众、关键信息和交付物收束成任务书。",
    href: "https://www.elon.edu/u/university-communications/marketing-communications/creative-services/creative-brief/",
  },
  {
    name: "Grounding",
    role: "要求生成内容绑定底稿、事实来源和证据缺口。",
    href: "https://cloud.google.com/vertex-ai/generative-ai/docs/grounding/overview",
  },
  {
    name: "Structured Outputs",
    role: "把交付物定义成稳定 Output Contract，而不是自由文本。",
    href: "https://platform.openai.com/docs/guides/structured-outputs",
  },
  {
    name: "Few-shot / Skill",
    role: "用示例文章和外部 writing skill 约束写法模式。",
    href: "https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/multishot-prompting",
  },
  {
    name: "Eval-driven Development",
    role: "先定义评分标准，再批量生成、比较和迭代。",
    href: "https://platform.openai.com/docs/guides/evals",
  },
];

const drafts: CandidateRecord[] = [
  {
    id: "static_candidate_1",
    version: "Version 1",
    title: "从文档包到文本生产：这次产品转向解决的不是页面问题",
    summary: "先给定位判断，再解释输入区、检查区和 Eval Profile 如何降低输入复杂性。",
    excerpt:
      "这次调整不是把旧页面换一层壳，而是把产品对象从“产物”换成“生产闭环”。输出仍然是文本，不稳定的是输入素材、写法来源和评审偏好。",
    total: 86,
    humanScore: "8.5",
    breakdown: {
      quality: 27,
      fit: 31,
      style: 22,
      risk: -4,
    },
    rationale: "覆盖完整，判断清楚；相似表达风险中等，标题可再收紧。",
    risk: "相似表达：中；事实漂移：低",
  },
  {
    id: "static_candidate_2",
    version: "Version 2",
    title: "先固定输入契约，再讨论生成质量",
    summary: "把重点放在 Job Spec 和 Precheck，适合做给主管的短版说明。",
    excerpt:
      "如果输入仍然是标题、参考文、转录稿和口头偏好混在一起，后续任何 prompt 优化都会变成一次性手工劳动。Job Spec 的价值是先把复杂性收束。",
    total: 82,
    humanScore: "8.0",
    breakdown: {
      quality: 26,
      fit: 29,
      style: 23,
      risk: -6,
    },
    rationale: "逻辑干净，但 Skill 生命周期解释不足；需要补发布条件。",
    risk: "相似表达：低；事实漂移：中",
  },
  {
    id: "static_candidate_3",
    version: "Version 3",
    title: "Writing Skill 不能从一篇参考文直接发布",
    summary: "强调资产沉淀和风险治理，适合后续展开成产品设计说明。",
    excerpt:
      "参考文章提供的是写法信号，不是可直接复制的资产。它必须先进入 Candidate，经多轮 eval 和人工评分稳定后，才有资格被发布和复用。",
    total: 78,
    humanScore: "7.6",
    breakdown: {
      quality: 25,
      fit: 27,
      style: 21,
      risk: -5,
    },
    rationale: "风险意识强，但对本期业务目标覆盖偏窄。",
    risk: "相似表达：低；事实漂移：低",
  },
];

const lifecycle = [
  { state: "candidate", status: "active", note: "当前 v0.3，来自本轮 Precheck 与人工评分" },
  { state: "ready-to-publish", status: "pending", note: "需要再 1 轮评分稳定证据" },
  { state: "published", status: "locked", note: "暂无，不能被本轮反馈直接覆盖" },
  { state: "blocked", status: "watch", note: "相似表达风险仍为中" },
];

const evidence = [
  ["迭代轮次", "3 轮"],
  ["平均人工分", "8.1 / 10"],
  ["风险状态", "相似表达中，事实漂移低"],
  ["版本说明", "收敛到内部决策复盘写法，暂不发布"],
];

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
  <div class="meta">Run: ${escapeHtml(runId)} · Candidate: ${escapeHtml(candidate.id)} · Score: ${candidate.total}</div>
  <div class="contract">
    <strong>Job Spec</strong><br />
    ${escapeHtml(jobSpec.title)}<br />
    ${escapeHtml(jobSpec.goal)}<br /><br />
    <strong>Output Contract</strong><br />
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
  const hasTaskWord = /目标|任务|主管|决策|下一步|闭环/.test(normalizedQuote);

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
      issue: "选中文本与当前主管偏好或写法参考不一致。",
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
      expected: "重新贴合 Job Spec 的目标和受众，明确给主管的判断与下一步。",
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
  context: {
    badge: "start context",
    description: "默认使用 Baseline；历史 Skill 只在明确复用时选择。",
    nextTitle: "选择生产上下文",
    nextHint: "Baseline 先服务本次任务；Category / Skill 负责复用历史写法，不作为默认前提。",
    precheckMetric: "blocked",
    draftsMetric: "blocked",
  },
  "precheck-ready": {
    badge: "check ready",
    description: "检查区已自动根据输入区加载；确认前不会生成候选。",
    nextTitle: "确认生成契约",
    nextHint: "修改左侧输入会自动刷新检查区；进入候选区的动作在检查区底部。",
    precheckMetric: "ready",
    draftsMetric: "blocked",
  },
  confirmed: {
    badge: "candidate ready",
    description: "检查结果已确认，本轮候选文本可按同一评分标准比较。",
    nextTitle: "评审候选区",
    nextHint: "选中文本打标签后自动生成规则草稿；需要新结果时再运行下一批。",
    precheckMetric: "confirmed",
    draftsMetric: "3",
  },
  finalize: {
    badge: "finalize",
    description: "已停止本轮规则迭代，只选择最终版本并导出本次产物。",
    nextTitle: "定稿导出",
    nextHint: "从当前批次选择 1 个 Text Artifact，然后导出 DOC。",
    precheckMetric: "confirmed",
    draftsMetric: "final",
  },
};

export default function WritingProductionPage() {
	const [spec, setSpec] = useState<JobSpec>(initialJobSpec);
	const [outputContract, setOutputContract] = useState<OutputContract>(initialOutputContract);
	const [quickIntake, setQuickIntake] = useState<QuickIntake>(initialQuickIntake);
	const [stage, setStage] = useState<FlowStage>("context");
	const [activeSource, setActiveSource] = useState<SourceKey | null>(null);
	const [selectedSkillId, setSelectedSkillId] = useState(skillOptions[0].id);
	const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
	const [finalizedCandidateId, setFinalizedCandidateId] = useState<string | null>(null);
	const [activeRun, setActiveRun] = useState<WritingRunRecord | null>(null);
	const [runDirty, setRunDirty] = useState(false);
	const [runtimeBusy, setRuntimeBusy] = useState(false);
	const [runtimeError, setRuntimeError] = useState<string | null>(null);
	const selectedSkill = skillOptions.find((skill) => skill.id === selectedSkillId) ?? skillOptions[0];
	const isBaselineSkill = selectedSkill.id === "baseline-no-skill";
	const selectedSkillScope = isBaselineSkill ? "本次文本" : selectedSkill.category;
	const displayDrafts = useMemo(
	  () => {
	    if (!activeRun?.candidates.length) {
	      return drafts;
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
	const bestDraftIndex = useMemo(
	  () => {
	    if (!displayDrafts.length) {
	      return 0;
	    }

	    return displayDrafts.reduce((bestIndex, draft, index) => (draft.total > displayDrafts[bestIndex].total ? index : bestIndex), 0);
	  },
	  [displayDrafts],
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

	function enterFinalize() {
	  const candidate = selectedDraft ?? displayDrafts[bestDraftIndex] ?? null;
	  if (!candidate) {
	    return;
	  }

	  setFinalizedCandidateId(candidate.id);
	  setStage("finalize");
	}

  const contentBriefChecks = useMemo<BaselineCheck[]>(
    () => [
      {
        title: "任务识别",
        source: "标题 / 任务",
        sourceKeys: ["intent"],
        method: "Creative Brief / Define：先定义本轮沟通任务。",
        detail: spec.title || "未填写标题。",
	        impact: "Draft 生成上下文，决定候选文本围绕哪个任务展开。",
        iteration: "未来可替换为行业化问题定义模板。",
      },
      {
        title: "目标识别",
        source: "目标",
        sourceKeys: ["intent"],
        method: "Creative Brief：明确受众、目的和期望结果。",
        detail: spec.goal || "未填写目标。",
	        impact: "任务匹配评分，以及候选文本的结论强度。",
        iteration: "未来可按业务类型扩展目标拆解规则。",
      },
      {
        title: "素材依据",
        source: "底稿",
        sourceKeys: ["evidence"],
        method: "Grounding：生成必须绑定可追溯素材。",
        detail: spec.source || "未填写底稿。",
	        impact: "事实边界、证据缺口和禁止编造范围。",
        iteration: "未来可接入引用、附件和转录稿结构化抽取。",
      },
      {
        title: "交付契约",
        source: "Output Contract",
        sourceKeys: ["output"],
        method: "Structured Outputs：先固定产物类型、长度、结构和格式，再生成内容。",
        detail: `${outputContract.artifactType} / ${outputContract.lengthRange} / ${outputContract.structure}`,
	        impact: "候选文本长度、结构、格式，以及 Eval Profile 的格式契约检查。",
        iteration: "未来可开放自定义 Output Contract 模板。",
      },
    ],
    [outputContract, spec],
  );

  const writingRuleChecks = useMemo<BaselineCheck[]>(
    () => [
      {
        title: "写法参考",
        source: "写法参考",
        sourceKeys: ["style"],
        method: "Few-shot / Skill：只抽取写法模式，不复制句子。",
        detail: spec.writingReference || "未提供写法参考。",
	        impact: "候选文本结构、语气、论证节奏和相似表达风险。",
        iteration: "未来可沉淀为可发布的 Writing Skill。",
      },
      {
        title: "评审偏好约束",
        source: "评审偏好",
        sourceKeys: ["review"],
        method: "Eval-driven Development：先定义偏好，再生成和评分。",
        detail: spec.reviewPreference || "未提供评审偏好。",
	        impact: "Eval Profile、人评分校准和下一轮规则调整。",
        iteration: "未来可按评分历史自动更新 Eval Profile。",
      },
    ],
    [outputContract, spec],
  );

  const scoringChecks = useMemo<BaselineCheck[]>(
    () => [
      {
        title: "任务目标匹配",
        source: "目标",
        sourceKeys: ["intent"],
        method: "Eval-driven Development：把目标转成可比较标准。",
        detail: spec.goal || "目标缺失时无法判断任务是否完成。",
	        impact: "Auto Eval 和人工评分表，用于判断候选是否跑偏。",
        iteration: "未来可按业务场景调整权重。",
      },
      {
        title: "格式契约匹配",
        source: "Output Contract",
        sourceKeys: ["output"],
        method: "Format Compliance：把长度、结构和格式转成可检查标准。",
        detail: `${outputContract.lengthRange}；${outputContract.formatRules}`,
	        impact: "Eval Profile 会检查候选是否满足交付物形态，而不只看写得好不好。",
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
        method: "Few-shot / Skill Eval：评估结构和语气是否匹配。",
        detail: spec.writingReference || "没有写法参考时仅使用 baseline 写法。",
	        impact: "风格偏好分和 Writing Skill Candidate 更新。",
        iteration: "未来可由多篇样本文自动提炼风格维度。",
      },
      {
        title: "偏好约束",
        source: "评审偏好",
        sourceKeys: ["review"],
        method: "Human preference eval：把主观偏好显性化。",
        detail: spec.reviewPreference || "没有评审偏好时仅使用 baseline 评分。",
	        impact: "人工评分、偏好冲突提示和下一轮生成约束。",
        iteration: "未来可从历史打分自动学习主管偏好。",
      },
    ],
    [spec],
  );

  const riskChecks = useMemo<BaselineCheck[]>(
    () => [
      {
        title: "事实缺口",
        source: "底稿",
        sourceKeys: ["evidence"],
        method: "Grounding risk check：识别材料不足导致的幻觉风险。",
        badge: spec.source.includes("缺少") ? "中" : "低",
        detail: spec.source.includes("缺少")
          ? "底稿明确提到缺少信息，需要在生成前保留为风险。"
          : "底稿已有内容，但仍需按素材生成，不补写未知事实。",
	        impact: "是否阻断生成、是否要求补充材料，以及风险扣分。",
        iteration: "未来可接入证据覆盖率阈值。",
      },
      {
        title: "相似表达",
        source: "写法参考",
        sourceKeys: ["style"],
        method: "Style transfer risk：区分结构借鉴和句式复制。",
        badge: spec.writingReference ? "中" : "低",
        detail: spec.writingReference
          ? "写法参考只能抽取结构和偏好，不能复制句式。"
          : "未提供写法参考，暂不触发仿写相似风险。",
	        impact: "生成禁区、相似表达扣分和 Skill 发布判断。",
        iteration: "未来可接入相似度检测和引用边界规则。",
      },
      {
        title: "特殊处理",
        source: "Output Contract",
        sourceKeys: ["output"],
        method: "Contract risk check：识别公式、TTS handoff、下游视觉处理等特殊约束。",
        badge: outputContract.specialHandling || outputContract.downstreamHandoff ? "中" : "低",
        detail: outputContract.specialHandling || outputContract.downstreamHandoff || "当前无特殊处理。",
	        impact: "决定是否需要在本节点标注低置信，或交给下游 TTS / Video 节点处理。",
        iteration: "未来可按领域节点提供专用 Contract、Skill 和 Eval。",
      },
      {
        title: "偏好不稳定",
        source: "评审偏好",
        sourceKeys: ["review"],
        method: "Preference calibration：识别不稳定偏好，避免过早固化。",
        badge: spec.reviewPreference.includes("不稳定") ? "中" : "低",
        detail: spec.reviewPreference.includes("不稳定")
          ? "评审偏好字段明确提到不稳定，Eval Profile 只能作为临时规则。"
          : "当前评审偏好未显式标记不稳定。",
	        impact: "本轮规则是否可发布，以及是否只能保留为 candidate。",
        iteration: "未来可用多轮人评分稳定性决定是否发布。",
      },
    ],
    [outputContract, spec],
  );

  function updateSpec(field: keyof JobSpec, value: string) {
    setSpec((current) => ({ ...current, [field]: value }));
    setRunDirty(true);
    setStage("precheck-ready");
  }

  function updateOutputContract(field: keyof OutputContract, value: string) {
    setOutputContract((current) => ({ ...current, [field]: value }));
    setRunDirty(true);
    setStage("precheck-ready");
  }

	async function createRunForSpec(nextSpec: JobSpec) {
	  const payload: CreateWritingRunInput = {
	    quickIntake: quickIntake.raw,
	    skill: {
	      id: selectedSkill.id,
	      category: selectedSkill.category,
	      version: selectedSkill.version,
	      status: selectedSkill.status,
	    },
	    outputProfile,
	    outputContract,
	    jobSpec: nextSpec,
	  };
	  const response = await fetch("/api/writing-runs", {
	    method: "POST",
	    headers: { "content-type": "application/json" },
	    body: JSON.stringify(payload),
	  });

	  if (!response.ok) {
	    throw new Error("创建 Writing Run 失败");
	  }

	  const data = (await response.json()) as { run: WritingRunRecord };
	  setActiveRun(data.run);
	  setRunDirty(false);
	  return data.run;
	}

	async function confirmPrecheck() {
	  setRuntimeBusy(true);
	  setRuntimeError(null);
	  try {
	    const sourceRun = activeRun && !runDirty ? activeRun : await createRunForSpec(spec);
	    const response = await fetch(`/api/writing-runs/${sourceRun.id}/confirm`, {
	      method: "POST",
	    });

	    if (!response.ok) {
	      throw new Error("确认 Precheck 失败");
	    }

	    const data = (await response.json()) as { run: WritingRunRecord };
	    setActiveRun(data.run);
	    setRunDirty(false);
	    setStage("confirmed");
	  } catch (error) {
	    setRuntimeError(error instanceof Error ? error.message : "运行时异常");
	  } finally {
	    setRuntimeBusy(false);
	  }
	}

	async function startJobSpec() {
	  const rawInput = quickIntake.raw.trim();
	  const firstLine = rawInput.split("\n").find((line) => line.trim())?.trim() ?? "";
	  const titleDraft =
	    firstLine.length > 52 ? `${firstLine.slice(0, 52)}...` : firstLine;
	  const nextSpec = {
	    ...spec,
	    title: titleDraft || spec.title,
	    goal: rawInput
	      ? `基于 Quick Intake 原始输入完成一篇${selectedSkillScope}；先明确核心判断，再给出可追溯依据和下一步建议。`
	      : spec.goal,
	    source: rawInput ? `Quick Intake 原始输入：${rawInput}` : spec.source,
	    writingReference: selectedSkill.prefill.writingReference,
	    reviewPreference: selectedSkill.prefill.reviewPreference,
	  };

	  setRuntimeBusy(true);
	  setRuntimeError(null);
	  setSpec(nextSpec);
	  setStage("precheck-ready");
	  try {
	    await createRunForSpec(nextSpec);
	  } catch (error) {
	    setRunDirty(true);
	    setRuntimeError(error instanceof Error ? error.message : "运行时异常");
	  } finally {
	    setRuntimeBusy(false);
	  }
	}

	async function recordFeedback(feedback: HumanFeedbackInput) {
	  if (!activeRun) {
	    setRuntimeError("没有可写入的 Writing Run");
	    return;
	  }

	  setRuntimeBusy(true);
	  setRuntimeError(null);
	  try {
	    const response = await fetch(`/api/writing-runs/${activeRun.id}/feedback`, {
	      method: "POST",
	      headers: { "content-type": "application/json" },
	      body: JSON.stringify({
	        ...feedback,
	        note:
	          feedback.note ??
	          (feedback.kind === "selection"
	            ? "用户通过选中文本提交局部反馈。"
	            : "用户提交人工反馈，用于校准下一轮 Skill Candidate。"),
	      }),
	    });

	    if (!response.ok) {
	      throw new Error("写入人工反馈失败");
	    }

	    const data = (await response.json()) as { run: WritingRunRecord };

	    if (feedback.kind === "selection") {
	      const patchResponse = await fetch(`/api/writing-runs/${data.run.id}/rule-patches`, {
	        method: "POST",
	        headers: { "content-type": "application/json" },
	        body: JSON.stringify({ candidateId: feedback.candidateId }),
	      });

	      if (!patchResponse.ok) {
	        throw new Error("自动生成规则草稿失败");
	      }

	      const patchData = (await patchResponse.json()) as { run: WritingRunRecord };
	      setActiveRun(patchData.run);
	      return;
	    }

	    setActiveRun(data.run);
	  } catch (error) {
	    setRuntimeError(error instanceof Error ? error.message : "运行时异常");
	  } finally {
	    setRuntimeBusy(false);
	  }
	}

	async function deleteFeedback(feedbackId: string) {
	  if (!activeRun) {
	    setRuntimeError("没有可写入的 Writing Run");
	    return;
	  }

	  setRuntimeBusy(true);
	  setRuntimeError(null);
	  try {
	    const response = await fetch(`/api/writing-runs/${activeRun.id}/feedback`, {
	      method: "DELETE",
	      headers: { "content-type": "application/json" },
	      body: JSON.stringify({ feedbackId }),
	    });

	    if (!response.ok) {
	      throw new Error("删除人工反馈失败");
	    }

	    const data = (await response.json()) as { run: WritingRunRecord };
	    setActiveRun(data.run);
	  } catch (error) {
	    setRuntimeError(error instanceof Error ? error.message : "运行时异常");
	  } finally {
	    setRuntimeBusy(false);
	  }
	}

	async function runGenerationBatch() {
	  if (!activeRun) {
	    setRuntimeError("没有可运行的 Writing Run");
	    return;
	  }

	  setRuntimeBusy(true);
	  setRuntimeError(null);
	  try {
	    const response = await fetch(`/api/writing-runs/${activeRun.id}/generation-batch`, {
	      method: "POST",
	      headers: { "content-type": "application/json" },
	      body: JSON.stringify({ candidateCount: 3 }),
	    });

	    if (!response.ok) {
	      throw new Error("运行下一批候选失败");
	    }

	    const data = (await response.json()) as { run: WritingRunRecord };
	    setActiveRun(data.run);
	    setStage("confirmed");
	  } catch (error) {
	    setRuntimeError(error instanceof Error ? error.message : "运行时异常");
	  } finally {
	    setRuntimeBusy(false);
	  }
	}

	function exportFinalizedDoc(candidate: CandidateRecord) {
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
	}

  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-950 dark:bg-zinc-100 dark:text-zinc-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="muted" className="font-mono">
                L1
              </Badge>
              <Badge variant="outline">Text Node Console</Badge>
              <Badge variant="secondary">{stageCopy[stage].badge}</Badge>
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-normal">
                doc-maker · Text Generation Node
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                当前节点只负责主文本生成：输入、检查、候选、反馈和下一批。TTS / Video 是下游节点，通过 Text Artifact + Handoff Contract 消费结果。
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5 lg:w-[650px]">
            <Metric label="Job" value={activeRun ? activeRun.status : "draft"} icon={CircleDot} />
            <Metric label="检查" value={stageCopy[stage].precheckMetric} icon={BookOpenCheck} />
            <Metric label="Artifact" value="text" icon={FileText} />
            <Metric label="Candidates" value={stageCopy[stage].draftsMetric} icon={FileText} />
            <Metric label="Writing Skill" value="v0.3" icon={Sparkles} />
          </div>
        </header>

        <section className="grid gap-3 rounded-lg border bg-white p-4 text-sm md:grid-cols-3">
          <InfoRow
            label="当前领域"
            value="Doc / Text：生成主文本、文本 Eval、Writing Skill。"
          />
          <InfoRow
            label="共用节点骨架"
            value="输入 -> 检查 -> 候选 -> 反馈 -> 规则草稿 -> 下一批。"
          />
          <InfoRow
            label="下游边界"
            value="TTS / Video 拥有自己的 Contract、Skill、Eval 和节点控制台。"
          />
        </section>

        <section className="sticky top-3 z-20 rounded-lg border border-zinc-300 bg-zinc-800 p-5 text-zinc-100 shadow-sm">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-zinc-600 bg-zinc-700 text-zinc-100">
                节点状态
              </Badge>
              <span className="text-xs text-zinc-400">{stageCopy[stage].description}</span>
            </div>
            <div>
              <h2 className="text-3xl font-semibold tracking-normal">
                {stageCopy[stage].nextTitle}
              </h2>
              <p className="mt-2 max-w-3xl text-sm text-zinc-300">
                {stageCopy[stage].nextHint}
              </p>
            </div>
		            <div className="grid gap-2 text-xs sm:grid-cols-7">
		              <FlowStep active={stage === "context"} done={stage !== "context"} label="Start Context" />
		              <FlowStep active={false} done={stage !== "context"} label="输入区" />
		              <FlowStep active={false} done={stage !== "context"} label="Output Contract" />
		              <FlowStep active={stage === "precheck-ready"} done={stage === "confirmed" || stage === "finalize"} label="检查区" />
		              <FlowStep active={stage === "precheck-ready"} done={stage === "confirmed" || stage === "finalize"} label="Eval Profile" />
		              <FlowStep active={stage === "confirmed"} done={stage === "finalize"} label="候选区" />
		              <FlowStep active={stage === "finalize"} done={false} label="定稿导出" />
		            </div>
	          </div>
	        </section>

	        {runtimeError ? (
	          <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-950">
	            {runtimeError}
	          </section>
	        ) : null}

	        {activeRun ? (
	          <section className="grid gap-3 rounded-lg border bg-white p-4 text-sm md:grid-cols-4">
	            <InfoRow label="Run ID" value={activeRun.id} />
	            <InfoRow label="Run Store" value={activeRun.storePath} />
	            <InfoRow label="Trace" value={`${activeRun.trace.length} events`} />
	            <InfoRow label="Eval Run" value={activeRun.evalRun?.id ?? "waiting"} />
	          </section>
	        ) : null}

	        {stage === "context" ? (
	          <section className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
	            <Card className="rounded-lg border-2 border-zinc-900 bg-white text-zinc-950 shadow-md">
	              <CardHeader>
	                <div className="flex items-start justify-between gap-3">
	                  <div>
	                    <CardTitle className="flex items-center gap-2 text-base">
	                      <StepMark active value="Start" />
	                      Skill Scope
	                    </CardTitle>
	                    <CardDescription>
	                      默认不选择历史 Skill；只有明确复用某类写法时才选择。
	                    </CardDescription>
	                  </div>
	                  <Badge variant="outline">pre-step</Badge>
	                </div>
	              </CardHeader>
	              <CardContent className="space-y-4">
	                <WarningCallout>
	                  Baseline mode 只使用本次输入生成临时 Writing Skill Candidate。历史 Skill 是可选模板，不是新 Job 的默认前提。
	                </WarningCallout>
	                <div className="grid gap-3">
	                  {skillOptions.map((skill) => (
	                    <button
	                      key={skill.id}
	                      type="button"
	                      onClick={() => setSelectedSkillId(skill.id)}
	                      className={cn(
	                        "rounded-lg border p-4 text-left transition-all",
	                        selectedSkillId === skill.id
	                          ? "border-zinc-900 bg-white shadow-md ring-2 ring-zinc-900/10"
	                          : "border-zinc-200 bg-zinc-50 hover:border-zinc-400",
	                        skill.status === "frozen" && "opacity-60",
	                      )}
	                    >
	                      <div className="flex flex-wrap items-center justify-between gap-2">
	                        <div className="font-semibold">{skill.category}</div>
	                        <Badge variant={selectedSkillId === skill.id ? "secondary" : "outline"}>
	                          {skill.status}
	                        </Badge>
	                      </div>
	                      <div className="mt-1 text-sm font-medium text-zinc-800">
	                        {skill.version}
	                      </div>
	                      <p className="mt-2 text-sm text-muted-foreground">
	                        {skill.description}
	                      </p>
	                    </button>
	                  ))}
	                </div>
	              </CardContent>
	            </Card>

	            <div className="space-y-6">
	              <Card className="rounded-lg border-2 border-zinc-900 bg-white text-zinc-950 shadow-md">
	                <CardHeader>
	                  <div className="flex items-start justify-between gap-3">
	                    <div>
	                      <CardTitle className="flex items-center gap-2 text-base">
	                        <Sparkles className="size-4" />
	                        Quick Intake
	                      </CardTitle>
	                      <CardDescription>
	                        只保留一个入口，系统生成可编辑的 Job Spec 草稿。
	                      </CardDescription>
	                    </div>
	                    <Badge variant="secondary">draft first</Badge>
	                  </div>
	                </CardHeader>
	                <CardContent className="space-y-4">
	                  <WarningCallout>
	                    Quick Intake 只生成草稿，不是最终契约；进入输入区后仍需要人工补全和确认。
	                  </WarningCallout>
	                  <label className="space-y-2">
	                    <span className="text-sm font-medium">Quick Intake 单入口</span>
	                    <Textarea
	                      value={quickIntake.raw}
	                      onChange={(event) =>
	                        setQuickIntake({
	                          raw: event.target.value,
	                        })
	                      }
	                      placeholder="把一句想法、会议记录、视频转文字、参考片段或底稿粘贴在这里。第一行会作为标题草稿。"
	                      className="min-h-56 resize-y"
	                    />
	                  </label>
	                  <div className="rounded-lg border border-dashed bg-zinc-50 p-3 text-sm text-muted-foreground">
	                    文档上传不作为独立入口展示；当前原型请先复制文档文本到这里，后续真实版本再把上传解析并回填到同一输入框。
	                  </div>
	                  <div className="flex flex-col gap-3 rounded-lg border bg-zinc-50 p-4 sm:flex-row sm:items-center sm:justify-between">
	                    <p className="text-sm text-muted-foreground">
	                      {isBaselineSkill
	                        ? "生成草稿只使用本次输入和 baseline stack，不套用历史 Skill。"
	                        : `生成草稿会带入 ${selectedSkill.category} 的写法参考、评审偏好和 baseline stack。`}
	                    </p>
	                    <Button onClick={startJobSpec} disabled={runtimeBusy}>
	                      {runtimeBusy ? "写入 run store..." : "生成 Job Spec 草稿"}
	                      <ArrowRight className="size-4" />
	                    </Button>
	                  </div>
	                </CardContent>
	              </Card>

	            <Card className="rounded-lg bg-white text-zinc-950 shadow-sm">
	              <CardHeader>
	                <div className="flex items-start justify-between gap-3">
	                  <div>
	                    <CardTitle className="flex items-center gap-2 text-base">
	                      <Sparkles className="size-4" />
	                      Auto-filled Baseline Stack
	                    </CardTitle>
	                    <CardDescription>
	                      {isBaselineSkill
	                        ? "当前使用 baseline 初始化依赖；历史 Skill 暂不参与本次任务。"
	                        : `选择 ${selectedSkill.version} 后，系统初始化下面这些依赖。`}
	                    </CardDescription>
	                  </div>
	                  <Badge variant="outline">
	                    {isBaselineSkill ? "No Skill selected" : selectedSkill.category}
	                  </Badge>
	                </div>
	              </CardHeader>
	              <CardContent className="space-y-4">
	                <section className="rounded-lg border bg-zinc-50 p-3 text-sm">
	                  <div className="font-medium">依赖链路</div>
	                  <p className="mt-1 text-muted-foreground">
		                    {isBaselineSkill
		                      ? "Baseline stack -> Job Spec -> Precheck Candidate -> Eval Profile -> Candidate Versions"
		                      : "Skill -> baseline stack -> Job Spec -> Precheck Candidate -> Eval Profile -> Candidate Versions"}
	                  </p>
	                </section>
	                <div className="grid gap-2 md:grid-cols-2">
	                  {autoFilledStack.map(([label, value]) => (
	                    <InfoRow key={label} label={label} value={value} />
	                  ))}
	                </div>
	                <div className="rounded-lg border border-dashed bg-zinc-50 p-4">
	                  <p className="text-sm text-muted-foreground">
	                    {isBaselineSkill
	                      ? "这里是系统 baseline 自动加载的规则依赖。用户不需要先选择风格类型，本轮 Precheck 会生成临时 Writing Skill Candidate。"
	                      : "这里是 Skill 选择后自动加载的规则依赖。用户不需要逐项填写，但需要理解这些 baseline 会影响 Job Spec 草稿、Precheck、Eval Profile 和候选评分。"}
	                  </p>
	                </div>
	              </CardContent>
	            </Card>
	            </div>
	          </section>
	        ) : null}

	        {stage === "precheck-ready" ? (
	          <section className="grid gap-6 xl:grid-cols-[minmax(340px,0.95fr)_minmax(320px,0.86fr)_minmax(280px,0.72fr)] xl:items-start">
            <Card
              id="job-spec"
              className={cn(
                "rounded-lg bg-white text-zinc-950 shadow-sm",
                "border-zinc-200",
              )}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <StepMark active={false} value="输入" />
                        输入区
                      </CardTitle>
                      <JobSpecHelpDialog />
                    </div>
	                    <CardDescription>
	                      人工填写原始任务；后续交给自动拆解流程处理。
	                    </CardDescription>
                  </div>
                  <Badge variant="outline">
                    editable
                  </Badge>
                </div>
	              </CardHeader>
	              <CardContent className="space-y-4">
	                <section className="rounded-lg border bg-zinc-50 p-3">
                  <div className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Job Spec 输入关系
                  </div>
                  <div className="grid gap-2 text-xs sm:grid-cols-5 xl:grid-cols-1 2xl:grid-cols-5">
                    <InputRelationStep
                      index="1"
                      title="问题定义"
                      body="要解决什么沟通任务"
                      sourceKey="intent"
                      activeSource={activeSource}
                      onActivate={setActiveSource}
                      onClear={() => setActiveSource(null)}
                    />
                    <InputRelationStep
                      index="2"
                      title="事实"
                      body="基于哪些素材"
                      sourceKey="evidence"
                      activeSource={activeSource}
                      onActivate={setActiveSource}
                      onClear={() => setActiveSource(null)}
                    />
                    <InputRelationStep
                      index="3"
                      title="交付契约"
                      body="多长、什么结构、什么格式"
                      sourceKey="output"
                      activeSource={activeSource}
                      onActivate={setActiveSource}
                      onClear={() => setActiveSource(null)}
                    />
                    <InputRelationStep
                      index="4"
                      title="写法"
                      body="参考怎样写"
                      sourceKey="style"
                      activeSource={activeSource}
                      onActivate={setActiveSource}
                      onClear={() => setActiveSource(null)}
                    />
                    <InputRelationStep
                      index="5"
                      title="评审"
                      body="按什么偏好判断"
                      sourceKey="review"
                      activeSource={activeSource}
                      onActivate={setActiveSource}
                      onClear={() => setActiveSource(null)}
                    />
                  </div>
	                  <p className="mt-3 text-xs text-muted-foreground">
	                    填写是并行的；字段会进入固定 schema，不直接变成最终规则。
	                  </p>
	                </section>
	                <WarningCallout>
	                  LLM 自动拆解存在不确定性和黑盒误判；输入区只提交原始材料，不直接产生可执行规则。
	                </WarningCallout>

                <Field
                  label="1. 标题 / 任务（问题定义）"
                  sourceKey="intent"
                  activeSource={activeSource}
                  onActivate={setActiveSource}
                  onClear={() => setActiveSource(null)}
                >
	                  <Input
	                    value={spec.title}
	                    onChange={(event) => updateSpec("title", event.target.value)}
	                    onClick={() => setActiveSource("intent")}
	                    onFocus={() => setActiveSource("intent")}
	                    onBlur={() => setActiveSource(null)}
	                  />
                </Field>
                <Field
                  label="1. 目标（问题定义）"
                  sourceKey="intent"
                  activeSource={activeSource}
                  onActivate={setActiveSource}
                  onClear={() => setActiveSource(null)}
                >
	                  <Textarea
	                    value={spec.goal}
	                    onChange={(event) => updateSpec("goal", event.target.value)}
	                    onClick={() => setActiveSource("intent")}
	                    onFocus={() => setActiveSource("intent")}
	                    onBlur={() => setActiveSource(null)}
	                    className="min-h-24"
	                  />
                </Field>
                <Field
                  label="2. 底稿 / 原始素材（事实）"
                  sourceKey="evidence"
                  activeSource={activeSource}
                  onActivate={setActiveSource}
                  onClear={() => setActiveSource(null)}
                >
	                  <Textarea
	                    value={spec.source}
	                    onChange={(event) => updateSpec("source", event.target.value)}
	                    onClick={() => setActiveSource("evidence")}
	                    onFocus={() => setActiveSource("evidence")}
	                    onBlur={() => setActiveSource(null)}
	                    className="min-h-24"
	                  />
                </Field>
                <section
                  className={cn(
                    "space-y-3 rounded-lg border bg-muted/30 p-3 transition",
                    activeSource === "output" && "border-zinc-500 bg-white shadow-sm",
                  )}
                  onMouseEnter={() => setActiveSource("output")}
                  onMouseLeave={() => setActiveSource(null)}
                  onFocus={() => setActiveSource("output")}
                  onBlur={() => setActiveSource(null)}
                  tabIndex={0}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium">3. Output Contract（交付物契约）</div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        固定本节点要交付什么文本：类型、长度、结构、格式和下游 handoff。
                      </p>
                    </div>
                    <Badge variant="outline">baseline</Badge>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field
                      label="产物类型"
                      sourceKey="output"
                      activeSource={activeSource}
                      onActivate={setActiveSource}
                      onClear={() => setActiveSource(null)}
                    >
                      <Input
                        value={outputContract.artifactType}
                        onChange={(event) => updateOutputContract("artifactType", event.target.value)}
                        onClick={() => setActiveSource("output")}
                        onFocus={() => setActiveSource("output")}
                        onBlur={() => setActiveSource(null)}
                      />
                    </Field>
                    <Field
                      label="长度范围"
                      sourceKey="output"
                      activeSource={activeSource}
                      onActivate={setActiveSource}
                      onClear={() => setActiveSource(null)}
                    >
                      <Input
                        value={outputContract.lengthRange}
                        onChange={(event) => updateOutputContract("lengthRange", event.target.value)}
                        onClick={() => setActiveSource("output")}
                        onFocus={() => setActiveSource("output")}
                        onBlur={() => setActiveSource(null)}
                      />
                    </Field>
                  </div>
                  <Field
                    label="结构要求"
                    sourceKey="output"
                    activeSource={activeSource}
                    onActivate={setActiveSource}
                    onClear={() => setActiveSource(null)}
                  >
                    <Textarea
                      value={outputContract.structure}
                      onChange={(event) => updateOutputContract("structure", event.target.value)}
                      onClick={() => setActiveSource("output")}
                      onFocus={() => setActiveSource("output")}
                      onBlur={() => setActiveSource(null)}
                    />
                  </Field>
                  <Field
                    label="格式规则"
                    sourceKey="output"
                    activeSource={activeSource}
                    onActivate={setActiveSource}
                    onClear={() => setActiveSource(null)}
                  >
                    <Textarea
                      value={outputContract.formatRules}
                      onChange={(event) => updateOutputContract("formatRules", event.target.value)}
                      onClick={() => setActiveSource("output")}
                      onFocus={() => setActiveSource("output")}
                      onBlur={() => setActiveSource(null)}
                    />
                  </Field>
                  <Field
                    label="依据规则"
                    sourceKey="output"
                    activeSource={activeSource}
                    onActivate={setActiveSource}
                    onClear={() => setActiveSource(null)}
                  >
                    <Textarea
                      value={outputContract.groundingRules}
                      onChange={(event) => updateOutputContract("groundingRules", event.target.value)}
                      onClick={() => setActiveSource("output")}
                      onFocus={() => setActiveSource("output")}
                      onBlur={() => setActiveSource(null)}
                    />
                  </Field>
                  <Field
                    label="特殊处理"
                    sourceKey="output"
                    activeSource={activeSource}
                    onActivate={setActiveSource}
                    onClear={() => setActiveSource(null)}
                  >
                    <Textarea
                      value={outputContract.specialHandling}
                      onChange={(event) => updateOutputContract("specialHandling", event.target.value)}
                      onClick={() => setActiveSource("output")}
                      onFocus={() => setActiveSource("output")}
                      onBlur={() => setActiveSource(null)}
                    />
                  </Field>
                  <Field
                    label="下游 Handoff"
                    sourceKey="output"
                    activeSource={activeSource}
                    onActivate={setActiveSource}
                    onClear={() => setActiveSource(null)}
                  >
                    <Textarea
                      value={outputContract.downstreamHandoff}
                      onChange={(event) => updateOutputContract("downstreamHandoff", event.target.value)}
                      onClick={() => setActiveSource("output")}
                      onFocus={() => setActiveSource("output")}
                      onBlur={() => setActiveSource(null)}
                    />
                  </Field>
                </section>
                <Field
                  label="4. 写法参考 / 外部 writing skill（写法）"
                  sourceKey="style"
                  activeSource={activeSource}
                  onActivate={setActiveSource}
                  onClear={() => setActiveSource(null)}
                >
	                  <Textarea
	                    value={spec.writingReference}
	                    onChange={(event) => updateSpec("writingReference", event.target.value)}
	                    onClick={() => setActiveSource("style")}
	                    onFocus={() => setActiveSource("style")}
	                    onBlur={() => setActiveSource(null)}
	                    className="min-h-24"
	                  />
                </Field>
                <Field
                  label="5. 评审偏好（评审）"
                  sourceKey="review"
                  activeSource={activeSource}
                  onActivate={setActiveSource}
                  onClear={() => setActiveSource(null)}
                >
	                  <Textarea
	                    value={spec.reviewPreference}
	                    onChange={(event) => updateSpec("reviewPreference", event.target.value)}
	                    onClick={() => setActiveSource("review")}
	                    onFocus={() => setActiveSource("review")}
	                    onBlur={() => setActiveSource(null)}
	                    className="min-h-24"
	                  />
                </Field>
                <div className="rounded-lg border border-dashed bg-zinc-50 p-4 text-sm text-muted-foreground">
                  输入区没有提交按钮。修改任一内容后，右侧检查区会自动按当前输入刷新。
                </div>
              </CardContent>
            </Card>

            <Card
              id="precheck"
              className={cn(
                "rounded-lg bg-white text-zinc-950 shadow-sm",
                stage === "precheck-ready" ? "border-2 border-zinc-500" : "border-zinc-200",
              )}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
	                  <div>
	                    <CardTitle className="flex items-center gap-2 text-base">
	                      <StepMark active={stage === "precheck-ready"} value="检查" />
	                      检查区
	                      <PrecheckHelpDialog />
	                    </CardTitle>
	                    <CardDescription>
	                      自动拆解产出待确认的 Precheck Candidate。
	                    </CardDescription>
	                  </div>
	                  <div className="flex flex-col items-end gap-2">
	                    <Badge variant={stage === "precheck-ready" ? "secondary" : "outline"}>
	                      auto loaded
	                    </Badge>
	                    <Badge variant="outline" className="bg-white">
	                      traceable only
	                    </Badge>
	                  </div>
	                </div>
		              </CardHeader>
	              <CardContent className="space-y-5">
	                <WarningCallout>
	                  LLM 会按 baseline schema 拆解输入，但结果可能漏项、误读或过度推断；确认前不能进入生成。
	                </WarningCallout>
	                <section className="space-y-3">
		                  <SectionTitle icon={FileText} title="Content Brief 来源检查" />
		                  <div className="grid gap-3">
                    {contentBriefChecks.map((item) => (
                      <TraceCard
                        key={item.title}
                        title={item.title}
	                        source={item.source}
	                        sourceKeys={item.sourceKeys}
	                        activeSource={activeSource}
	                        detail={item.detail}
	                        impact={item.impact}
	                        iteration={item.iteration}
                      />
                    ))}
                  </div>
                </section>

	                <Separator />

	                <section className="space-y-3">
	                  <SectionTitle icon={Sparkles} title="写法规则来源检查" />
                  <div className="grid gap-3">
                    {writingRuleChecks.map((item) => (
                      <TraceCard
                        key={item.title}
                        title={item.title}
	                        source={item.source}
	                        sourceKeys={item.sourceKeys}
	                        activeSource={activeSource}
	                        detail={item.detail}
	                        impact={item.impact}
	                        iteration={item.iteration}
                      />
                    ))}
                  </div>
                </section>

	                <section className="space-y-3">
	                  <SectionTitle icon={ShieldAlert} title="风险检查" />
                  <div className="grid gap-3">
                    {riskChecks.map((risk) => (
                      <TraceCard
                        key={risk.title}
                        title={risk.title}
	                        source={risk.source}
	                        sourceKeys={risk.sourceKeys}
	                        activeSource={activeSource}
	                        detail={risk.detail}
	                        impact={risk.impact}
	                        iteration={risk.iteration}
                        badge={risk.badge}
                      />
                    ))}
                  </div>
                </section>

                <div className="flex flex-col gap-3 rounded-lg border border-dashed bg-zinc-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
	                    确认 Precheck Candidate 后，系统才会批量生成候选文本。
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setStage("precheck-ready")}>
                      重新检查
                    </Button>
                    <Button size="sm" onClick={confirmPrecheck} disabled={runtimeBusy}>
                      {runtimeBusy ? "生成中..." : "确认检查结果并生成候选"}
                      <ArrowRight className="size-4" />
                    </Button>
                  </div>
	                </div>
	              </CardContent>
	            </Card>

	            <Card
	              id="eval-profile"
	              className="rounded-lg border-2 border-zinc-900 bg-white text-zinc-950 shadow-md xl:sticky xl:top-36"
	            >
	              <CardHeader>
	                <div className="flex items-start justify-between gap-3">
	                  <div>
	                    <CardTitle className="flex items-center gap-2 text-base">
	                      <StepMark active value="评估" />
	                      Eval Profile
	                    </CardTitle>
	                    <CardDescription>
	                      由 Precheck Candidate 派生初始评分契约。
	                    </CardDescription>
	                  </div>
	                  <Badge variant="outline" className="bg-zinc-50">
	                    独立产物
	                  </Badge>
	                </div>
	              </CardHeader>
	              <CardContent className="space-y-4">
	                <WarningCallout>
	                  Eval Profile 不直接读取输入区混乱材料；它由 Precheck Candidate 派生，并显式读取 Output Contract。LLM 生成的评分契约可能带偏置或漏项，需要人工确认。
	                </WarningCallout>
	                <section className="rounded-lg border bg-zinc-50 p-3 text-sm">
	                  <div className="font-medium">直接输入</div>
	                  <p className="mt-1 text-muted-foreground">
	                    Precheck Candidate + Output Contract：任务匹配、格式契约、素材忠实度、写法一致性、风险检查。
	                  </p>
	                </section>
	                <div className="grid gap-3">
	                  {scoringChecks.map((item) => (
	                    <TraceCard
	                      key={item.title}
	                      title={item.title}
	                      source={item.source}
	                      sourceKeys={item.sourceKeys}
	                      activeSource={activeSource}
	                      detail={item.detail}
	                      impact={item.impact}
	                      iteration={item.iteration}
	                    />
	                  ))}
	                </div>
	              </CardContent>
	            </Card>
	          </section>
        ) : null}

        {stage === "confirmed" ? (
          <div className="space-y-6">
            <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
              <Card
                id="drafts"
                className="rounded-lg border-2 border-zinc-950 bg-white text-zinc-950 shadow-sm"
              >
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <StepMark active={stage === "confirmed"} value="评审" />
                      Candidate Review
                    </CardTitle>
                    <CardDescription>
                      只负责阅读候选、打反馈、自动生成规则草稿和运行下一批；不做最终导出。
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Badge variant="secondary">规则反馈</Badge>
                    <Badge variant="outline">
                      {latestGenerationRun ? `第 ${latestGenerationRun.round} 批` : "ready"}
                    </Badge>
                    <Button size="sm" onClick={enterFinalize} disabled={!selectedDraft}>
                      进入定稿
                      <ArrowRight className="size-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {activeRun ? (
                  <section className="grid gap-3 rounded-lg border bg-zinc-50 p-3 text-sm md:grid-cols-3">
                    <InfoRow
                      label="当前规则快照"
                      value={latestGenerationRun?.ruleSnapshotId ?? "rules-v1"}
                    />
                    <InfoRow label="本屏候选" value={`${displayDrafts.length} 个最新版本`} />
                    <InfoRow
                      label="历史保留"
                      value={`${activeRun.candidates.length} 个候选 / ${activeRun.generationRuns.length} 批`}
                    />
                  </section>
                ) : null}

                {selectedDraft ? (
                  <CandidateWorkspace
                    drafts={displayDrafts}
                    selectedDraft={selectedDraft}
                    selectedIndex={selectedDraftIndex}
                    bestDraftIndex={bestDraftIndex}
	                    feedback={activeRun?.feedback ?? []}
	                    onSelectCandidate={setSelectedCandidateId}
	                    onFeedback={activeRun ? recordFeedback : undefined}
	                    disabled={runtimeBusy}
	                  />
                ) : null}

                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  人工反馈只进入反馈账本和规则草稿；不会改写旧候选，也不会直接覆盖 Published Skill。
                </div>

                {activeRun ? <ReadOnlyRunDetails run={activeRun} /> : null}
              </CardContent>
              </Card>

              <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
                {activeRun ? (
                  <>
                    <CandidateWorkflowPanel
                      run={activeRun}
                      latestGenerationRunId={latestGenerationRun?.id}
                      runtimeBusy={runtimeBusy}
                      onRunGenerationBatch={runGenerationBatch}
                    />
                    <DecisionQueuePanel
                      run={activeRun}
                      disabled={runtimeBusy}
                      onDeleteFeedback={deleteFeedback}
                    />
                  </>
                ) : null}
              </aside>
            </section>

          </div>
        ) : null}

        {stage === "finalize" && activeRun && finalizedDraft ? (
          <FinalizeExportPanel
            drafts={displayDrafts}
            selectedCandidateId={finalizedDraft.id}
            onSelectCandidate={setFinalizedCandidateId}
            onBack={() => setStage("confirmed")}
            onExportDoc={exportFinalizedDoc}
          />
        ) : null}
      </div>
    </main>
  );
}

function JobSpecHelpDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-md text-muted-foreground hover:text-zinc-950"
          aria-label="查看 Job Spec 初始化说明"
        >
          <CircleHelp className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Baseline Job Spec 初始化说明</DialogTitle>
          <DialogDescription>
            当前提供系统内置 baseline，先把写作任务环境初始化清楚；自定义字段、规则类型或风格类型暂不在 UI 暴露。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <section className="rounded-lg border bg-zinc-50 p-4 text-zinc-950">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">当前能力边界</div>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                  系统提供一套内置写作任务环境：问题定义、底稿、交付形态、写法参考和评审偏好。用户现在可以编辑本轮内容和 Precheck 产物，但不能新增字段、规则类型或风格类型。
                </p>
              </div>
              <Badge className="border-zinc-300 bg-white text-zinc-700">
                baseline only
              </Badge>
            </div>
          </section>

          <section>
            <div className="mb-2 text-sm font-medium">方法论引用</div>
            <div className="grid gap-2 text-xs md:grid-cols-2">
              {methodologyReferences.map((reference) => (
                <a
                  key={reference.name}
                  href={reference.href}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border bg-zinc-50 p-3 text-muted-foreground transition hover:border-zinc-950 hover:bg-white hover:text-zinc-950"
                >
                  <span className="font-medium text-zinc-950">{reference.name}</span>
                  <span className="mt-1 block leading-5">{reference.role}</span>
                </a>
              ))}
            </div>
          </section>

          <p className="text-sm text-muted-foreground">
            后续可演进为用户自定义配置；当前版本的设计目标是先把 baseline 规则说清楚、跑通、可评估。新增结构能力需要修改代码。
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PrecheckHelpDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-md text-muted-foreground hover:text-zinc-950"
          aria-label="查看 Precheck 设计说明"
        >
          <CircleHelp className="size-4" />
        </Button>
      </DialogTrigger>
	      <DialogContent className="max-h-[82vh] max-w-3xl overflow-hidden p-0">
	        <div className="border-b px-6 py-5">
		        <DialogHeader>
		          <DialogTitle>Baseline Precheck 设计说明</DialogTitle>
		          <DialogDescription>
		            LLM 按 baseline schema 把左侧动态输入拆成可生成、可评分、可迭代的本轮候选契约。
		          </DialogDescription>
		        </DialogHeader>
	        </div>
		        <div className="max-h-[calc(82vh-112px)] overflow-y-auto px-6 py-4">
		        <div className="grid gap-2 text-sm text-muted-foreground">
		          <WarningCallout>
		            Warning：这里存在 LLM 黑盒不确定性。所有自动拆解、规则候选和评分契约都必须可追溯、可修改、可确认。
		          </WarningCallout>
	          <InfoRow
	            label="底层原理"
	            value="LLM 不是数据库查询或确定性规则引擎。它是在上下文里做语义压缩、模式匹配和结构化生成；baseline schema 只能约束输出形状，不能保证理解一定正确。"
	            wide
	          />
	          <InfoRow
	            label="为什么有风险"
	            value="当输入材料含糊、缺字段、口头偏好不稳定时，LLM 会倾向于补全合理但未被证据支持的连接，也可能漏掉低显著度约束或重新排序重点。"
	            wide
	          />
	          <InfoRow
	            label="Content Brief 逻辑"
	            value="LLM 从标题、目标、底稿和 Output Contract 中抽取任务、受众、目的、已知事实、证据缺口、交付约束；它应该只压缩和归一，不应新增事实。"
	            wide
	          />
	          <InfoRow
	            label="Content Brief 风险"
	            value="可能出现新增事实、遗漏限制、误判受众、把写法参考当事实、把主管偏好过度泛化，或把低置信内容写成确定结论。"
	            wide
	          />
	          <InfoRow
	            label="后果"
	            value="Content Brief 一旦错，Draft 会跑题或事实漂移；Eval Profile 会按错误目标评分；风险检查可能漏报；Writing Skill Candidate 会沉淀错误写法。"
	            wide
	          />
	          <InfoRow
	            label="检查指导"
	            value="逐项看来源、派生结果和影响：是否能回到输入字段，是否新增未给出的事实，是否遗漏关键限制，是否会改变生成方向或评分标准。任一不通过就修改输入或检查项，不进入候选生成。"
	            wide
	          />
	          <InfoRow
	            label="LLM 做什么"
	            value="LLM 自动拆解原始输入，生成 Content Brief、写法规则候选、风险检查和 Eval Profile 初稿。"
		            wide
		          />
		          <InfoRow
		            label="规则是什么"
		            value="规则不是自由 prompt，而是内置 baseline schema：问题定义、事实边界、交付结构、写法模式、评审偏好、风险。"
		            wide
		          />
		          <InfoRow
		            label="用户做什么"
		            value="用户确认或修改 Precheck Candidate。确认前不会进入候选生成；确认后才把它当作本轮生成契约。"
		            wide
		          />
		          <InfoRow
		            label="方法论"
		            value="方法论不是占位文案。它是 baseline 的设计依据，默认收在这里，不在每张检查卡里重复展示。"
	            wide
	          />
	          <InfoRow
	            label="来源关系"
	            value="输入字段与检查项是一对多关系。点击或聚焦左侧字段时，右侧关联检查项高亮；未关联检查项降灰。"
	            wide
	          />
	          <InfoRow
	            label="来源：底稿"
	            value="表示该检查项依赖事实、证据和缺口边界；影响素材忠实度、事实风险和是否需要补料。"
	          />
	          <InfoRow
	            label="来源：Output Contract"
	            value="表示该检查项依赖产物类型、长度、结构、格式和下游 handoff；影响候选文本形态和 Eval Profile，不代表写作事实。"
	          />
	          <InfoRow
	            label="依赖关系"
	            value="输入区变化后，检查区自动刷新；确认按钮只负责进入候选区。"
	            wide
	          />
	          <InfoRow
	            label="检查模块影响"
	            value="Content Brief 进入 Draft 上下文；写法规则进入 Candidate 约束；Precheck Candidate 派生 Eval Profile；风险检查进入扣分、阻断和发布判断。"
	            wide
	          />
	          <InfoRow
	            label="方法论映射"
	            value="Content Brief 对应 Creative Brief / Grounding；写法规则对应 Few-shot / Skill；Eval Profile 对应 Eval-driven Development；风险检查对应 Grounding risk / Style transfer risk / Preference calibration。"
	            wide
	          />
	          <InfoRow
	            label="baseline 边界"
	            value="当前只能改本轮内容和检查结果；新增字段、规则类型、风格类型需要改代码。"
            wide
          />
	        </div>
	        </div>
	      </DialogContent>
    </Dialog>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <span className="text-xs">{label}</span>
      </div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function FlowStep({
  label,
  active,
  done,
}: {
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2",
        active && "border-zinc-500 bg-zinc-700 text-zinc-100",
        done && !active && "border-zinc-600 bg-zinc-800 text-zinc-300",
        !active && !done && "border-zinc-700 text-zinc-500",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono">{label}</span>
        {done ? <CheckCircle2 className="size-3.5" /> : null}
      </div>
    </div>
  );
}

function StepMark({ value, active }: { value: string; active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 min-w-7 items-center justify-center rounded-md border px-2 font-mono text-xs",
        active ? "border-zinc-700 bg-zinc-700 text-zinc-100" : "border-zinc-200 bg-zinc-100 text-zinc-500",
      )}
    >
      {value}
    </span>
  );
}

function InputRelationStep({
  index,
  title,
  body,
  sourceKey,
  activeSource,
  onActivate,
  onClear,
}: {
  index: string;
  title: string;
  body: string;
  sourceKey: SourceKey;
  activeSource: SourceKey | null;
  onActivate: (sourceKey: SourceKey) => void;
  onClear: () => void;
}) {
  const active = activeSource === sourceKey;

  return (
    <div
      className={cn(
        "rounded-md border bg-white p-2 transition",
        active && "border-zinc-500 shadow-sm",
      )}
      onMouseEnter={() => onActivate(sourceKey)}
      onMouseLeave={onClear}
      onFocus={() => onActivate(sourceKey)}
      onBlur={onClear}
      tabIndex={0}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex h-5 w-5 items-center justify-center rounded font-mono text-[10px]",
            active ? "bg-zinc-900 text-white" : "bg-zinc-700 text-zinc-100",
          )}
        >
          {index}
        </span>
        <span className="font-medium">{title}</span>
      </div>
      <div className="mt-1 text-muted-foreground">{body}</div>
    </div>
  );
}

function Field({
  label,
  children,
  sourceKey,
  activeSource,
  onActivate,
  onClear,
}: {
  label: string;
  children: ReactNode;
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
	      onMouseEnter={() => sourceKey && onActivate?.(sourceKey)}
	      onMouseLeave={onClear}
	      onFocusCapture={() => sourceKey && onActivate?.(sourceKey)}
	    >
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function SectionTitle({
  icon: Icon,
  title,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold">
      <Icon className="size-4" />
      {title}
    </div>
  );
}

function WarningCallout({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" />
      <div>
        <div className="font-medium">Warning</div>
        <p className="mt-1 leading-5">{children}</p>
      </div>
    </div>
  );
}

function TraceCard({
  title,
  source,
  sourceKeys,
  activeSource,
  detail,
  impact,
  iteration,
  badge,
}: {
  title: string;
  source: string;
  sourceKeys: SourceKey[];
  activeSource: SourceKey | null;
  detail: string;
  impact: string;
  iteration: string;
  badge?: string;
}) {
  const active = activeSource !== null && sourceKeys.includes(activeSource);
  const dimmed = activeSource !== null && !active;

	return (
	  <div
	    data-source-keys={sourceKeys.join(" ")}
	    className={cn(
	      "relative overflow-hidden rounded-lg border bg-white p-3 text-sm transition-all duration-200",
	      !active && !dimmed && "border-dashed border-zinc-200 bg-zinc-50",
	      active &&
	        "z-10 scale-[1.015] border-zinc-900 bg-white shadow-xl shadow-zinc-900/15 ring-4 ring-zinc-900/10",
	      dimmed && "border-zinc-200 bg-zinc-100 opacity-45 grayscale",
	    )}
	  >
	    {dimmed ? <div className="pointer-events-none absolute inset-0 bg-zinc-200/45" /> : null}
	      <div className="flex flex-wrap items-center justify-between gap-2">
	        <div className="font-medium">{title}</div>
	        <div className="flex items-center gap-2">
          <Badge
	            variant="outline"
	            className={cn(
	              "border-dashed bg-white font-normal text-zinc-600",
	              active && "border-zinc-900 bg-zinc-900 text-white",
	            )}
	          >
	            来源：{source}
          </Badge>
          {badge ? (
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-900">
              {badge}
            </Badge>
          ) : null}
	        </div>
	      </div>
	      <div className="mt-3 space-y-3">
	        <p className="leading-6 text-zinc-800">{detail}</p>
	        <div className="grid gap-2">
	          <TraceLine label="影响" value={impact} />
	          <TraceLine label="迭代" value={iteration} />
	        </div>
	      </div>
	    </div>
	  );
}

function TraceLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[44px_1fr]">
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="text-muted-foreground">{value}</p>
    </div>
  );
}

function InfoRow({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={cn("rounded-md border bg-muted/30 px-3 py-2", wide && "md:col-span-2")}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium leading-5">{value}</div>
    </div>
  );
}

function FinalizeExportPanel({
  drafts,
  selectedCandidateId,
  onSelectCandidate,
  onBack,
  onExportDoc,
}: {
  drafts: CandidateRecord[];
  selectedCandidateId: string;
  onSelectCandidate: (candidateId: string) => void;
  onBack: () => void;
  onExportDoc: (candidate: CandidateRecord) => void;
}) {
  const selectedDraft = drafts.find((draft) => draft.id === selectedCandidateId) ?? drafts[0];

  return (
    <Card className="rounded-lg border-2 border-zinc-950 bg-white text-zinc-950 shadow-sm">
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <StepMark active value="定稿" />
              Finalize Export
            </CardTitle>
            <CardDescription>
              只做最终选择和导出。这里不打反馈、不生成规则、不运行下一批。
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onBack}>
              返回评审
            </Button>
            <Button
              size="sm"
              disabled={!selectedDraft}
              onClick={() => selectedDraft && onExportDoc(selectedDraft)}
            >
              <Download className="size-4" />
              导出本次 DOC
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <section className="rounded-lg border bg-zinc-50 p-3 text-sm">
          <div className="font-medium">定稿规则</div>
          <p className="mt-1 text-muted-foreground">
            当前只从本批候选中选择 1 个 Text Artifact 导出；TTS、视觉指导和 DOCX 排版是下游节点或 Export Package 节点职责。
          </p>
        </section>

        <div className="grid gap-4 lg:grid-cols-3">
          {drafts.map((draft) => {
            const active = draft.id === selectedDraft?.id;

            return (
              <button
                key={draft.id}
                type="button"
                className={cn(
                  "flex min-h-64 flex-col rounded-xl border bg-white p-4 text-left shadow-sm transition",
                  active
                    ? "border-2 border-zinc-900 bg-zinc-50"
                    : "hover:border-zinc-400 hover:bg-zinc-50/50",
                )}
                onClick={() => onSelectCandidate(draft.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={active ? "secondary" : "outline"} className="font-mono">
                    {draft.version}
                  </Badge>
                  <span className="text-sm font-semibold">{draft.total}</span>
                </div>
                <h3 className="mt-3 line-clamp-2 text-base font-semibold">{draft.title}</h3>
                <p className="mt-2 text-xs text-muted-foreground">{draft.summary}</p>
                <div className="mt-4 flex-1 overflow-hidden rounded-lg border bg-white p-3">
                  <p className="line-clamp-6 text-sm leading-6 text-zinc-800">{draft.excerpt}</p>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{active ? "已选为本次定稿" : "点击选择"}</span>
                  {active ? <CheckCircle2 className="size-4 text-zinc-900" /> : null}
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function CandidateWorkspace({
  drafts,
  selectedDraft,
  selectedIndex,
  bestDraftIndex,
  feedback,
  onSelectCandidate,
  onFeedback,
  disabled,
}: {
  drafts: CandidateRecord[];
  selectedDraft: CandidateRecord;
  selectedIndex: number;
  bestDraftIndex: number;
  feedback: HumanFeedbackRecord[];
  onSelectCandidate: (candidateId: string) => void;
  onFeedback?: (feedback: HumanFeedbackInput) => Promise<void> | void;
  disabled?: boolean;
}) {
  const [selectedQuote, setSelectedQuote] = useState("");
  const selectedFeedbacks = feedback.filter(
    (item) => item.candidateId === selectedDraft.id && item.kind === "selection",
  );

  function captureSelection() {
    const quote = window.getSelection()?.toString().trim().replace(/\s+/g, " ") ?? "";
    if (quote.length < 2) {
      return;
    }

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
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[230px_minmax(0,1fr)]">
      <aside className="rounded-xl border bg-zinc-50 p-3 lg:sticky lg:top-24 lg:self-start">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">版本导航</div>
            <p className="mt-1 text-xs text-muted-foreground">卡片只负责切换，不承载全文。</p>
          </div>
          <Badge variant="outline">{drafts.length}</Badge>
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
                    {draft.total}
                  </span>
                </div>
                <div className="mt-2 line-clamp-2 text-sm font-medium text-zinc-950">
                  {draft.title}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {index === bestDraftIndex ? (
                    <Badge
                      variant="secondary"
                      className={cn(active && "border border-zinc-300 bg-white text-zinc-900")}
                    >
                      最高分
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
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="font-mono">
                  {selectedDraft.version || `Version ${selectedIndex + 1}`}
                </Badge>
                {selectedIndex === bestDraftIndex ? <Badge variant="outline">当前最高分</Badge> : null}
                <Badge variant="outline">长文阅读器</Badge>
              </div>
              <h3 className="mt-2 text-lg font-semibold">{selectedDraft.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{selectedDraft.summary}</p>
            </div>
            <div className="flex min-w-32 items-center gap-2 rounded-lg border bg-white px-3 py-2 shadow-sm">
              <BarChart3 className="size-4 text-muted-foreground" />
              <div>
                <div className="text-lg font-semibold">{selectedDraft.total}</div>
                <div className="text-xs text-muted-foreground">auto score</div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4">
          <section className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50/25">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <BookOpenCheck className="size-4 text-amber-700" />
                阅读区
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="size-3.5 text-amber-600" />
                <span>无字数设置；正文独立滚动，选中片段后打标签。</span>
                {selectedFeedbacks.length ? (
                  <Badge variant="secondary">{selectedFeedbacks.length} 条反馈已记录</Badge>
                ) : null}
              </div>
            </div>
            <div className="max-h-[62vh] overflow-y-auto bg-white/80">
              <p
                className="whitespace-pre-wrap p-5 text-[15px] leading-8 text-zinc-900 selection:bg-amber-200 selection:text-zinc-950"
                onMouseUp={captureSelection}
                onKeyUp={captureSelection}
              >
                {selectedDraft.excerpt}
              </p>
            </div>
          </section>

          {selectedQuote ? (
            <section className="rounded-xl border-2 border-amber-300 bg-amber-50 p-3 text-sm shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">轻反馈标签</div>
                  <p className="mt-1 max-w-2xl text-muted-foreground">
                    点标签即写入反馈账本，并自动生成规则草稿；标签不再堆在正文卡片里。
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-full p-1 text-muted-foreground hover:bg-white hover:text-zinc-900"
                  onClick={() => setSelectedQuote("")}
                  aria-label="取消选中文本反馈"
                >
                  <X className="size-4" />
                </button>
              </div>
              <blockquote className="mt-3 rounded-lg border-l-4 border-amber-500 bg-white px-3 py-2 text-zinc-800">
                {selectedQuote}
              </blockquote>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium shadow-sm hover:border-zinc-900 hover:bg-zinc-950 hover:text-white"
                  disabled={disabled || !onFeedback}
                  onClick={() => submitSelectionFeedback("revise")}
                >
                  不满意
                </button>
                <button
                  type="button"
                  className="rounded-full border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 shadow-sm hover:border-emerald-700 hover:bg-emerald-700 hover:text-white"
                  disabled={disabled || !onFeedback}
                  onClick={() => submitSelectionFeedback("liked")}
                >
                  喜欢
                </button>
                <button
                  type="button"
                  className="rounded-full border border-sky-300 bg-white px-3 py-1.5 text-xs font-medium text-sky-800 shadow-sm hover:border-sky-700 hover:bg-sky-700 hover:text-white"
                  disabled={disabled || !onFeedback}
                  onClick={() => submitSelectionFeedback("rewrite")}
                >
                  需要改写
                </button>
              </div>
            </section>
          ) : null}

          <section className="rounded-xl border bg-zinc-50 p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">Auto Eval</div>
              <Badge variant="outline" className="bg-white">backend rubric</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <Score label="基础质量" source="Auto Eval" value={selectedDraft.breakdown.quality} />
              <Score label="任务匹配" source="Auto Eval" value={selectedDraft.breakdown.fit} />
              <Score label="风格偏好" source="Auto Eval" value={selectedDraft.breakdown.style} />
              <Score label="风险扣分" source="Auto Eval" value={selectedDraft.breakdown.risk} danger />
            </div>
          </section>

          <div className="flex flex-col gap-3 border-t pt-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1 text-sm">
              <p>{selectedDraft.rationale}</p>
              <p className="flex items-center gap-2 text-muted-foreground">
                <AlertTriangle className="size-4 text-amber-600" />
                {selectedDraft.risk}
              </p>
            </div>
            <p className="max-w-sm rounded-lg border bg-zinc-50 px-3 py-2 text-xs text-muted-foreground">
              人工动作只保留“选中文本 + 打标签”。系统会自动归因并生成规则草稿，右侧反馈账本负责展示处理状态。
            </p>
          </div>
        </div>
      </article>
    </section>
  );
}

function CandidateWorkflowPanel({
  run,
  latestGenerationRunId,
  runtimeBusy,
  onRunGenerationBatch,
}: {
  run: WritingRunRecord;
  latestGenerationRunId?: string;
  runtimeBusy?: boolean;
  onRunGenerationBatch: () => Promise<void> | void;
}) {
  const generationRuns = run.generationRuns ?? [];
  const ruleSnapshots = run.ruleSnapshots ?? [];
  const rulePatches = run.rulePatches ?? [];
  const latestGenerationRun =
    generationRuns.find((item) => item.id === latestGenerationRunId) ?? generationRuns.at(-1);
  const activeRuleSnapshot =
    ruleSnapshots.find((item) => item.id === latestGenerationRun?.ruleSnapshotId) ??
    ruleSnapshots.at(-1);
  const unprocessedFeedback = run.feedback.filter(
    (item) => (item.status ?? "unprocessed") === "unprocessed",
  );
  const compiledFeedback = run.feedback.filter((item) => item.status === "compiled");
  const draftPatches = rulePatches.filter((item) => item.status === "draft");
  const appliedPatches = rulePatches.filter((item) => item.status === "applied");
  const nextAction =
    unprocessedFeedback.length > 0
      ? "反馈已写入，系统会自动编译为规则草稿。"
      : draftPatches.length > 0
        ? "规则草稿已准备好，可以运行下一批。"
        : "继续阅读候选，选中文本打标签。";

  return (
    <section className="rounded-lg border-2 border-zinc-900 bg-white p-4 text-sm shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <SectionTitle icon={CircleDot} title="决策侧栏" />
            <Badge variant="secondary">编辑 / 决策</Badge>
          </div>
          <p className="mt-2 text-muted-foreground">
            反馈会自动合并为最多 {RULE_PATCH_DRAFT_LIMIT} 条规则草稿；旧候选冻结保存，运行下一批才生成新版本。
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-lg border bg-zinc-50 p-3">
        <div className="text-xs text-muted-foreground">下一步</div>
        <div className="mt-1 text-sm font-semibold">{nextAction}</div>
      </div>

      <Button
        className="mt-3 w-full"
        size="sm"
        disabled={runtimeBusy || draftPatches.length === 0}
        onClick={onRunGenerationBatch}
      >
        运行下一批
      </Button>

      <div className="mt-4 grid gap-2">
        <WorkflowStep
          title="1. Feedback"
          value={`${unprocessedFeedback.length} 未处理`}
          detail={`${compiledFeedback.length} 已编译 / ${run.feedback.length} total`}
          active={unprocessedFeedback.length > 0}
          done={run.feedback.length > 0 && unprocessedFeedback.length === 0}
        />
        <WorkflowStep
          title="2. Rule Patch"
          value={`${draftPatches.length}/${RULE_PATCH_DRAFT_LIMIT} 草稿`}
          detail={`${appliedPatches.length} 已用于规则快照；超出自动合并`}
          active={draftPatches.length > 0}
          done={appliedPatches.length > 0 && draftPatches.length === 0}
        />
        <WorkflowStep
          title="3. Rule Snapshot"
          value={activeRuleSnapshot?.version ?? "rules-v1"}
          detail={`${activeRuleSnapshot?.rules.length ?? 0}/${RULE_SNAPSHOT_RULE_LIMIT} active rules；${ruleSnapshots.length || 1} 个版本`}
          active={false}
          done={ruleSnapshots.length > 0}
        />
        <WorkflowStep
          title="4. Generation Run"
          value={latestGenerationRun ? `第 ${latestGenerationRun.round} 批` : "待生成"}
          detail={`${generationRuns.length} 批已保存`}
          active={false}
          done={generationRuns.length > 0}
        />
      </div>
    </section>
  );
}

function DecisionQueuePanel({
  run,
  disabled,
  onDeleteFeedback,
}: {
  run: WritingRunRecord;
  disabled?: boolean;
  onDeleteFeedback?: (feedbackId: string) => Promise<void> | void;
}) {
  const unprocessedFeedback = run.feedback.filter(
    (item) => (item.status ?? "unprocessed") === "unprocessed",
  );
  const compiledFeedback = run.feedback.filter((item) => item.status === "compiled");
  const draftPatches = run.rulePatches.filter((item) => item.status === "draft");
  const appliedPatches = run.rulePatches.filter((item) => item.status === "applied");

  return (
    <section className="rounded-lg border bg-white p-4 text-sm shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <SectionTitle icon={BookOpenCheck} title="处理队列" />
          <p className="mt-2 text-muted-foreground">
            这里不编辑正文，只显示哪些反馈会进入规则；草稿超过上限会自动合并，不继续堆积。
          </p>
        </div>
        <Badge variant="outline">队列</Badge>
      </div>

      <div className="mt-4 space-y-3">
        <section className="rounded-lg border bg-zinc-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="font-medium">反馈账本</div>
            <Badge variant={run.feedback.length ? "secondary" : "muted"}>
              {run.feedback.length} total
            </Badge>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md border bg-white p-2">
              <div className="text-muted-foreground">已编译</div>
              <div className="mt-1 text-sm font-semibold">{compiledFeedback.length}</div>
            </div>
            <div className="rounded-md border bg-white p-2">
              <div className="text-muted-foreground">待处理</div>
              <div className="mt-1 text-sm font-semibold">{unprocessedFeedback.length}</div>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            打标签后先进入反馈账本；自动生成规则草稿后，反馈会从“待处理”移到“已编译”。
          </p>
        </section>

        <section className="rounded-lg border bg-zinc-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="font-medium">待处理反馈</div>
            <Badge variant={unprocessedFeedback.length ? "secondary" : "muted"}>
              {unprocessedFeedback.length}
            </Badge>
          </div>
          <div className="mt-3 space-y-2">
            {unprocessedFeedback.slice(0, 4).map((feedback) => (
              <div key={feedback.id} className="rounded-md border bg-white p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {feedback.candidateId}
                  </span>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline">{feedback.businessReason ?? feedback.kind}</Badge>
                    {onDeleteFeedback ? (
                      <button
                        type="button"
                        className="rounded-full p-1 text-muted-foreground hover:bg-zinc-100 hover:text-zinc-900 disabled:pointer-events-none disabled:opacity-40"
                        disabled={disabled}
                        onClick={() => onDeleteFeedback(feedback.id)}
                        aria-label="删除反馈标签"
                      >
                        <X className="size-3.5" />
                      </button>
                    ) : null}
                  </div>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-zinc-700">
                  {feedback.quote || feedback.note}
                </p>
              </div>
            ))}
            {!unprocessedFeedback.length ? (
              <p className="text-xs text-muted-foreground">
                暂无待处理反馈。去左侧阅读区选中文本并点一个标签。
              </p>
            ) : null}
          </div>
        </section>

        <section className="rounded-lg border bg-zinc-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="font-medium">规则草稿</div>
            <Badge variant={draftPatches.length ? "secondary" : "muted"}>
              {draftPatches.length}/{RULE_PATCH_DRAFT_LIMIT}
            </Badge>
          </div>
          <div className="mt-3 space-y-2">
            {draftPatches.slice(0, RULE_PATCH_DRAFT_LIMIT).map((patch) => (
              <div key={patch.id} className="rounded-md border bg-white p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {patch.sourceCandidateId}
                  </span>
                  <Badge variant="outline">{patch.status}</Badge>
                </div>
                <p className="mt-1 text-xs font-medium">{patch.rule}</p>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{patch.reason}</p>
              </div>
            ))}
            {!draftPatches.length ? (
              <p className="text-xs text-muted-foreground">
                暂无规则草稿。去左侧阅读区打标签后，系统会自动把反馈编译成规则草稿。
              </p>
            ) : null}
            {draftPatches.length ? (
              <p className="text-xs text-muted-foreground">
                草稿池上限 {RULE_PATCH_DRAFT_LIMIT} 条；同类反馈合并，超出后并入最近草稿。Active Rule Snapshot 上限 {RULE_SNAPSHOT_RULE_LIMIT} 条规则。
              </p>
            ) : null}
          </div>
        </section>

        <section className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          已应用规则 {appliedPatches.length} 条。应用后只生成新的 Rule Snapshot，不回写历史候选。
        </section>
      </div>
    </section>
  );
}

function ReadOnlyRunDetails({ run }: { run: WritingRunRecord }) {
  return (
    <section className="rounded-lg border bg-white text-sm shadow-sm">
      <details>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
          <div>
            <div className="flex items-center gap-2">
              <SectionTitle icon={FileText} title="只读详情" />
              <Badge variant="outline">历史 / Eval / Skill</Badge>
            </div>
            <p className="mt-1 text-muted-foreground">
              低频信息默认收起，需要追溯评分、规则和发布证据时再展开。
            </p>
          </div>
          <ArrowRight className="size-4 text-muted-foreground" />
        </summary>

        <div className="space-y-5 border-t p-4">
          {run.evalRun ? (
            <section className="rounded-lg border bg-zinc-50 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <SectionTitle icon={BarChart3} title="Eval Run 面板" />
                  <p className="mt-2 text-muted-foreground">
                    4 个基础评分来自后台 Auto Eval；人工反馈只校准后续规则，不覆盖系统分。
                  </p>
                </div>
                <Badge variant="outline">{run.evalRun.id}</Badge>
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-3">
                <InfoRow label="Profile" value={run.evalRun.profileVersion} />
                <InfoRow label="Risk" value={run.evalRun.riskSummary} />
                <InfoRow label="Trace" value={`${run.trace.length} events`} />
              </div>
              <div className="mt-4 grid gap-3">
                {run.evalRun.candidateResults.map((result) => (
                  <div key={result.candidateId} className="rounded-md border bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-xs">{result.candidateId}</span>
                      <Badge variant="secondary">{result.total}</Badge>
                    </div>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <InfoRow label="强信号" value={result.strongestSignal} />
                      <InfoRow label="弱信号" value={result.weakestSignal} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-lg border bg-zinc-50 p-3">
            <SectionTitle icon={Sparkles} title="Writing Skill Lifecycle" />
            <p className="mt-2 text-muted-foreground">Candidate 稳定后才可发布为复用资产。</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border-2 border-zinc-900 bg-white p-3 shadow-sm">
                <SectionTitle icon={CircleDot} title="Runtime Skill Candidate" />
                <div className="mt-3 grid gap-2">
                  <InfoRow label="ID" value={run.skillCandidate.id} />
                  <InfoRow label="Human feedback" value={`${run.feedback.length} 条`} />
                  <InfoRow
                    label="Mean score"
                    value={run.skillCandidate.meanHumanScore?.toString() ?? "waiting"}
                  />
                  <InfoRow label="Update" value={run.skillCandidate.updateNote} wide />
                </div>
              </div>
              <div className="space-y-3">
                {lifecycle.map((item) => (
                  <div
                    key={item.state}
                    className={cn(
                      "rounded-lg border bg-white p-3",
                      item.status === "active" && "border-primary bg-primary/5",
                      item.status === "watch" &&
                        "border-amber-200 bg-amber-50 text-amber-950",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-sm">{item.state}</span>
                      <Badge
                        variant={
                          item.status === "active"
                            ? "secondary"
                            : item.status === "watch"
                              ? "outline"
                              : "muted"
                        }
                      >
                        {item.status}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{item.note}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3 rounded-lg border bg-zinc-50 p-3">
              <SectionTitle icon={CheckCircle2} title="发布前证据" />
              <div className="grid gap-2">
                {evidence.map(([label, value]) => (
                  <InfoRow key={label} label={label} value={value} />
                ))}
              </div>
            </div>

            <div className="space-y-3 rounded-lg border bg-zinc-50 p-3">
              <SectionTitle icon={ShieldAlert} title="Drift / Retro Eval" />
              <WarningCallout>
                长周期视频反馈和审美变化会导致评分漂移；历史评分不能覆盖，只能追加新版本重评。
              </WarningCallout>
              <div className="grid gap-2">
                {governanceRules.map(([label, value]) => (
                  <InfoRow key={label} label={label} value={value} />
                ))}
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-lg border bg-zinc-50 p-3">
            <SectionTitle icon={LockKeyhole} title="高级动作" />
            <div className="rounded-lg border bg-white p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">技术导出：Codex/Claude SKILL.md</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    仅从 Published Writing Skill 生成，不在普通流程编辑。
                  </p>
                </div>
                <Button variant="outline" size="sm" disabled>
                  等待发布
                </Button>
              </div>
            </div>
          </section>
        </div>
      </details>
    </section>
  );
}

function WorkflowStep({
  title,
  value,
  detail,
  active,
  done,
}: {
  title: string;
  value: string;
  detail: string;
  active?: boolean;
  done?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-white p-3",
        active && "border-zinc-900 shadow-sm",
        done && !active && "border-emerald-200 bg-emerald-50/40",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium text-muted-foreground">{title}</div>
        {done ? <CheckCircle2 className="size-3.5 text-emerald-700" /> : null}
      </div>
      <div className="mt-2 text-sm font-semibold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

function DraftCard({
  draft,
  index,
  isBest,
  selectionFeedbackCount,
  selectionFeedbacks = [],
  onFeedback,
  onDeleteFeedback,
  disabled,
}: {
  draft: CandidateRecord;
  index: number;
  isBest: boolean;
  selectionFeedbackCount?: number;
  selectionFeedbacks?: HumanFeedbackRecord[];
  onFeedback?: (feedback: HumanFeedbackInput) => Promise<void> | void;
  onDeleteFeedback?: (feedbackId: string) => Promise<void> | void;
  disabled?: boolean;
}) {
  const [selectedQuote, setSelectedQuote] = useState("");
  const currentSelectionFeedbackCount = selectionFeedbacks.length || selectionFeedbackCount || 0;

  function captureSelection() {
    const quote = window.getSelection()?.toString().trim().replace(/\s+/g, " ") ?? "";
    if (quote.length < 2) {
      return;
    }

    setSelectedQuote(quote.slice(0, 180));
  }

  async function submitSelectionFeedback(verdict: SelectionFeedbackDraft["verdict"]) {
    const draftFeedback = analyzeSelectionFeedback(draft, selectedQuote, verdict);
    await onFeedback?.({
      kind: "selection",
      candidateId: draft.id,
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
  }

  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl border bg-white shadow-sm ring-1 ring-zinc-950/5 transition-shadow",
        isBest ? "border-zinc-900 shadow-lg" : "border-zinc-200",
      )}
    >
      <div className="flex flex-col gap-3 border-b bg-zinc-50/90 p-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={isBest ? "secondary" : "muted"}
              className="font-mono"
            >
              {draft.version || `Version ${index + 1}`}
            </Badge>
            {isBest ? <Badge variant="outline">当前最高分</Badge> : null}
            <h3 className="text-base font-semibold">{draft.title}</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            同一生成契约下的候选版本 {index + 1}，用于和其他版本横向比较。
          </p>
          <p className="text-sm text-muted-foreground">{draft.summary}</p>
        </div>
        <div className="flex min-w-32 items-center gap-2 rounded-lg border bg-white px-3 py-2 shadow-sm">
          <BarChart3 className="size-4 text-muted-foreground" />
          <div>
            <div className="text-lg font-semibold">{draft.total}</div>
            <div className="text-xs text-muted-foreground">auto score</div>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <section className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50/25">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <BookOpenCheck className="size-4 text-amber-700" />
              阅读区
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="size-3.5 text-amber-600" />
              <span>选中片段后点一个标签，立即记录反馈。</span>
              {currentSelectionFeedbackCount ? (
                <Badge variant="secondary">{currentSelectionFeedbackCount} 条局部反馈</Badge>
              ) : null}
            </div>
          </div>
          <p
            className="bg-white/70 p-4 text-[15px] leading-7 text-zinc-900 selection:bg-amber-200 selection:text-zinc-950"
            onMouseUp={captureSelection}
            onKeyUp={captureSelection}
          >
            {draft.excerpt}
          </p>
        </section>

        {selectedQuote ? (
          <section className="rounded-xl border-2 border-amber-300 bg-amber-50 p-3 text-sm shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">轻反馈标签</div>
                <p className="mt-1 max-w-2xl text-muted-foreground">
                  系统用选中文本、Job Spec 和 Eval Profile 自动归因；点标签即写入反馈账本并生成规则草稿。
                </p>
              </div>
              <button
                type="button"
                className="rounded-full p-1 text-muted-foreground hover:bg-white hover:text-zinc-900"
                onClick={() => setSelectedQuote("")}
                aria-label="取消选中文本反馈"
              >
                <X className="size-4" />
              </button>
            </div>
            <blockquote className="mt-3 rounded-lg border-l-4 border-amber-500 bg-white px-3 py-2 text-zinc-800">
              {selectedQuote}
            </blockquote>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium shadow-sm hover:border-zinc-900 hover:bg-zinc-950 hover:text-white"
                disabled={disabled || !onFeedback}
                onClick={() => submitSelectionFeedback("revise")}
              >
                不满意
              </button>
              <button
                type="button"
                className="rounded-full border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 shadow-sm hover:border-emerald-700 hover:bg-emerald-700 hover:text-white"
                disabled={disabled || !onFeedback}
                onClick={() => submitSelectionFeedback("liked")}
              >
                喜欢
              </button>
              <button
                type="button"
                className="rounded-full border border-sky-300 bg-white px-3 py-1.5 text-xs font-medium text-sky-800 shadow-sm hover:border-sky-700 hover:bg-sky-700 hover:text-white"
                disabled={disabled || !onFeedback}
                onClick={() => submitSelectionFeedback("rewrite")}
              >
                需要改写
              </button>
            </div>
          </section>
        ) : null}

        {selectionFeedbacks.length ? (
          <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">已记录反馈标签</div>
              <div className="text-xs text-muted-foreground">右上角 x 可撤回</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectionFeedbacks.map((feedback) => (
                <FeedbackTag
                  key={feedback.id}
                  feedback={feedback}
                  disabled={disabled}
                  onDelete={onDeleteFeedback}
                />
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-xl border bg-zinc-50 p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">Auto Eval</div>
            <Badge variant="outline" className="bg-white">backend rubric</Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <Score label="基础质量" source="Auto Eval" value={draft.breakdown.quality} />
            <Score label="任务匹配" source="Auto Eval" value={draft.breakdown.fit} />
            <Score label="风格偏好" source="Auto Eval" value={draft.breakdown.style} />
            <Score label="风险扣分" source="Auto Eval" value={draft.breakdown.risk} danger />
          </div>
        </section>

        <div className="flex flex-col gap-3 border-t pt-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1 text-sm">
            <p>{draft.rationale}</p>
            <p className="flex items-center gap-2 text-muted-foreground">
              <AlertTriangle className="size-4 text-amber-600" />
              {draft.risk}
            </p>
          </div>
          <p className="max-w-sm rounded-lg border bg-zinc-50 px-3 py-2 text-xs text-muted-foreground">
            人工动作只保留“选中文本 + 打标签”。系统会自动归因并生成规则草稿。
          </p>
        </div>
      </div>
    </article>
  );
}

function FeedbackTag({
  feedback,
  disabled,
  onDelete,
}: {
  feedback: HumanFeedbackRecord;
  disabled?: boolean;
  onDelete?: (feedbackId: string) => Promise<void> | void;
}) {
  const isPositive = feedback.businessReason === "正向样本";

  return (
    <div
      className={cn(
        "relative max-w-sm rounded-xl border bg-white px-3 py-2 pr-8 shadow-sm",
        isPositive ? "border-emerald-200" : "border-amber-200",
      )}
    >
      <button
        type="button"
        className="absolute right-1 top-1 rounded-full p-1 text-muted-foreground hover:bg-zinc-100 hover:text-zinc-900 disabled:pointer-events-none disabled:opacity-40"
        disabled={disabled || !onDelete}
        onClick={() => onDelete?.(feedback.id)}
        aria-label="删除反馈标签"
      >
        <X className="size-3.5" />
      </button>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={isPositive ? "secondary" : "outline"}>
          {feedback.businessReason ?? "局部反馈"}
        </Badge>
        <Badge variant="muted">
          {(feedback.status ?? "unprocessed") === "compiled" ? "已编译" : "未处理"}
        </Badge>
        {feedback.confidence ? (
          <span className="text-[11px] text-muted-foreground">{feedback.confidence}</span>
        ) : null}
      </div>
      {feedback.quote ? (
        <p className="mt-1 line-clamp-2 text-xs text-zinc-700">{feedback.quote}</p>
      ) : null}
      {feedback.issue ? (
        <p className="mt-1 text-[11px] text-muted-foreground">{feedback.issue}</p>
      ) : null}
    </div>
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
  value: number;
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
        {value > 0 ? `+${value}` : value}
      </div>
    </div>
  );
}
