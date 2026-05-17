"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";

import {
	AlertTriangle,
	ArrowRight,
	BarChart3,
	BookOpenCheck,
	CheckCircle2,
  ChevronLeft,
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
import type { FrameworkNodeRunRecord, LLMCallTraceRecord } from "@/lib/framework-run-types";
import {
  compileWritingRulePatch,
  confirmWritingRun,
  createWritingRunRecord,
  deleteWritingFeedback,
  deriveRuleScope,
  finalizeWritingRunRecord,
  listWritingRuns,
  recordWritingFeedback,
  runWritingGenerationBatch,
} from "@/lib/writing-run-client";
import type {
  CandidateRecord,
  CreateWritingRunInput,
  HumanFeedbackInput,
  HumanFeedbackRecord,
  TextOutputContract,
  WritingJobSpec,
  WritingRuleScopeItem,
  WritingRuleScopeRecord,
  WritingRunRecord,
} from "@/lib/writing-run-types";
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

type SkillPackageOption = {
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
    "已有 UI 讨论记录、OpenSpec 讨论记录、业务侧产品反馈；材料中缺少明确的主管评分样本。",
  writingReference:
    "参考专业技术作者的结构：先给判断，再拆证据，最后给可执行下一步；外部写作方法包 偏理性、低修辞、少口号。",
  reviewPreference:
    "主管审美不稳定。当前偏好：不要营销腔，不要泛泛谈 AI；标题克制，观点要可被追问。",
};

const initialQuickIntake: QuickIntake = {
  raw: "",
  referencePaste: "",
};

const outputProfile = {
  name: "短文本产物",
  summary: "当前默认交付形态：短解释文本。下游 TTS、视觉指导和视频制作由独立节点处理。",
  artifacts: ["short_text"],
};

const initialOutputContract: OutputContract = {
  artifactType: "short explanatory text",
  lengthRange: "300-500 中文字（约 60-90 秒口播基准）",
  structure: "标题 + 判断开场 + 2-3 个短论证段 + 下一步",
  formatRules: "Markdown 正文；除非任务明确要求，不生成表格。",
  groundingRules: "每个关键判断必须能回指到底稿、用户输入或标注为待确认。",
  specialHandling: "不编造事实；不复制参考文句式；不确定内容标注低置信；复杂公式只标记为下游专项处理。",
  downstreamHandoff: "输出短文本产物；TTS 目标 60-90 秒；视频在下游节点独立处理。",
};

const skillPackageOptions: SkillPackageOption[] = [
  {
    id: "baseline-no-package",
    category: "本次文本",
    version: "Baseline / No Published Skill Package",
    status: "baseline mode",
    description: "不套用历史类型，只根据本次快速输入和输入契约生成临时写作规则候选。",
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
        "参考专业技术作者的结构：先给判断，再拆证据，最后给可执行下一步；外部写作方法包 偏理性、低修辞、少口号。",
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
    description: "历史偏移较大，当前不推荐作为新任务起点。",
    prefill: {
      writingReference:
        "历史口播样本只可参考节奏和信息密度，不复制句式；当前版本因偏移较大，默认不推荐继续开新主题。",
      reviewPreference:
        "重点检查是否过度口语化、是否制造夸张承诺、是否与业务事实脱节；低置信内容不能沉淀为 Skill Package。",
    },
  },
];

const autoFilledStack = [
  ["写作规则范围", "由快速输入和参考文本提炼结构、语气、禁忌、检查点，用户删减确认。"],
  ["输入契约", "渲染输入区字段：标题、目标、底稿、写法参考、评审偏好。"],
  ["生成前检查", "初始化内容摘要、依据边界、写作规则候选和风险检查。"],
  ["评分口径", "初始化基础质量、任务匹配、风格偏好、风险扣分和权重。"],
  ["输出契约", "默认短解释文本：300-500 中文字、60-90 秒口播基准、Markdown 格式和下游 handoff。"],
  ["写作约束", "带入结构、语气、禁止项、相似表达边界。"],
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
  <div class="meta">任务: ${escapeHtml(runId)} · 候选: ${escapeHtml(candidate.id)} · 评分: ${candidate.total}</div>
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
      expected: "重新贴合输入契约里的目标和受众，明确给主管的判断与下一步。",
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
    description: "默认使用 Baseline；历史 Skill Package 只在明确复用时选择。",
    nextTitle: "输入任务材料",
    nextHint: "Baseline 先服务本次任务；Category / Skill Package 负责复用历史写法，不作为默认前提。",
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
  const [jobView, setJobView] = useState<JobView>("all");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(1280);
  const [compactOverlay, setCompactOverlay] = useState<"inspector" | null>(null);
  const [workbenchLayout, setWorkbenchLayout] = useState<Record<string, number> | undefined>(DEFAULT_WORKBENCH_LAYOUT);
	const [selectedSkillPackageId, setSelectedSkillPackageId] = useState(skillPackageOptions[0].id);
	const [ruleScope, setRuleScope] = useState<WritingRuleScopeRecord | null>(null);
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
    if (run.status === "finalized") {
      return "finalize";
    }

    return run.candidates.length > 0 ? "review" : "precheck";
  }

  function upsertAvailableRun(run: WritingRunRecord) {
    setAvailableRuns((current) => [
      run,
      ...current.filter((item) => item.id !== run.id),
    ]);
  }

  function applyRun(run: WritingRunRecord, nextStage: FlowStage = stageForRun(run)) {
    setActiveRun(run);
    setSpec(run.jobSpec);
    setOutputContract(run.outputContract ?? initialOutputContract);
    setQuickIntake({
      raw: run.quickIntake ?? "",
      referencePaste: run.referencePaste ?? run.ruleScope?.referencePaste ?? "",
    });
    setRuleScope(run.ruleScope ?? null);
    setSelectedCandidateId(run.finalizedCandidateId ?? null);
    setFinalizedCandidateId(run.finalizedCandidateId ?? null);
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
      window.history.replaceState(null, "", `/?runId=${encodeURIComponent(activeRun.id)}&stage=${nextStage}`);
    }
  }

  useEffect(() => {
    if (hasLoadedLatestRun && (!requestedRunId || activeRun?.id === requestedRunId)) {
      return;
    }

    let cancelled = false;

    async function loadLatestRun() {
      try {
        const data = await listWritingRuns();
        const targetRun = requestedRunId
          ? data.runs.find((run) => run.id === requestedRunId) ?? data.runs[0]
          : data.runs[0];

        if (cancelled) {
          return;
        }

        setAvailableRuns(data.runs);
        if (targetRun) {
          applyRun(targetRun, requestedStage ?? stageForRun(targetRun));
          if (requestedCandidateId) {
            setSelectedCandidateId(requestedCandidateId);
            setFinalizedCandidateId((current) => current ?? requestedCandidateId);
          }
          setCenterMode("editor");
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
      window.history.replaceState(null, "", `/?runId=${encodeURIComponent(activeRun.id)}&stage=finalize&candidateId=${encodeURIComponent(candidate.id)}`);
    }
	}

  function selectFinalizedCandidate(candidateId: string) {
    setFinalizedCandidateId(candidateId);
    setSelectedCandidateId(candidateId);
  }

  function startNewJobDraft() {
    window.history.replaceState(null, "", "/");
    setActiveRun(null);
    setExpandedRunId(null);
    setRuleScope(null);
    setSpec(initialJobSpec);
    setOutputContract(initialOutputContract);
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
	        impact: "自动评分和人工评分表，用于判断候选是否跑偏。",
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
        iteration: "未来可从历史打分自动学习主管偏好。",
      },
    ],
    [spec],
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
    setRunDirty(true);
    setStage("precheck");
  }

  async function deriveRuleScopeForIntake(signal?: AbortSignal) {
    const data = await deriveRuleScope({
      quickIntake: quickIntake.raw,
      referencePaste: quickIntake.referencePaste,
    }, { signal });
    setRuleScope(data.ruleScope);
    return data.ruleScope;
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
  ) {
    const confirmedScope = scopeOverride
        ? {
          ...scopeOverride,
          status: "confirmed" as const,
        }
      : null;
	  const payload: CreateWritingRunInput = {
	    quickIntake: quickIntake.raw,
      referencePaste: quickIntake.referencePaste,
      ruleScope: confirmedScope,
	    skillPackage: {
	      id: selectedSkillPackage.id,
	      category: selectedSkillPackage.category,
	      version: selectedSkillPackage.version,
	      status: selectedSkillPackage.status,
	    },
	    outputProfile,
	    outputContract,
	    jobSpec: nextSpec,
	  };
	  const data = await createWritingRunRecord(payload, { signal });
	  setActiveRun(data.run);
    upsertAvailableRun(data.run);
	  setRunDirty(false);
	  return data.run;
	}

	async function confirmPrecheck() {
	  const signal = beginRuntimeTask(activeRun && !runDirty ? "candidate_generation" : "precheck_normalization");
	  try {
	    const sourceRun = activeRun && !runDirty ? activeRun : await createRunForSpec(spec, ruleScope, signal);
      switchRuntimeTask("candidate_generation");
	    const data = await confirmWritingRun(sourceRun.id, { signal });
	    setActiveRun(data.run);
      upsertAvailableRun(data.run);
      setJobView((current) => (current === "all" ? current : jobViewForRun(data.run)));
	    setRunDirty(false);
	    setStage("review");
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
      const activeScope = ruleScope ?? (await deriveRuleScopeForIntake(signal));
      if (!activeScope.items.length) {
        setRuntimeError("写作规则范围为空，至少保留 1 条规则范围。");
        return;
      }
      switchRuntimeTask("precheck_normalization");
      await createRunForSpec(spec, activeScope, signal);
      setStage("precheck");
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
	    const activeScope = ruleScope ?? (await deriveRuleScopeForIntake(signal));
	    if (!activeScope.items.length) {
	      setRuntimeError("写作规则范围为空，至少保留 1 条规则范围。");
	      return;
	    }
      switchRuntimeTask("precheck_normalization");

	    const firstLine = rawInput.split("\n").find((line) => line.trim())?.trim() ?? "";
	    const titleDraft = firstLine.length > 52 ? `${firstLine.slice(0, 52)}...` : firstLine;
	    const scopeReference = activeScope.items
	      .map((item) => `${scopeKindLabel[item.kind]}：${item.text}`)
	      .join("\n");
	    const nextSpec = {
	      ...spec,
	      title: titleDraft || spec.title,
	      goal: rawInput
	        ? `基于快速输入原始内容完成一篇${selectedRuleScope}；先明确核心判断，再给出可追溯依据和下一步建议。`
	        : spec.goal,
	      source: [
	        rawInput ? `快速输入原始内容：${rawInput}` : spec.source,
	        quickIntake.referencePaste.trim() ? `参考文本：${quickIntake.referencePaste.trim()}` : "",
	      ]
	        .filter(Boolean)
	        .join("\n"),
	      writingReference:
	        [selectedSkillPackage.prefill.writingReference, scopeReference].filter(Boolean).join("\n") ||
	        spec.writingReference,
	      reviewPreference: selectedSkillPackage.prefill.reviewPreference || spec.reviewPreference,
	    };

	    setSpec(nextSpec);
	    setStage("precheck");
	    await createRunForSpec(nextSpec, activeScope, signal);
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
	      setActiveRun(patchData.run);
        upsertAvailableRun(patchData.run);
        setJobView((current) => (current === "all" ? current : jobViewForRun(patchData.run)));
	      return;
	    }

	    setActiveRun(data.run);
      upsertAvailableRun(data.run);
      setJobView((current) => (current === "all" ? current : jobViewForRun(data.run)));
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
	    setActiveRun(data.run);
      upsertAvailableRun(data.run);
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
	    setActiveRun(data.run);
      upsertAvailableRun(data.run);
      setJobView((current) => (current === "all" ? current : jobViewForRun(data.run)));
	    setStage("review");
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
      setActiveRun(data.run);
      upsertAvailableRun(data.run);
      setFinalizedCandidateId(candidate.id);
      setJobView((current) => (current === "all" ? current : jobViewForRun(data.run)));
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : "定稿状态写入失败");
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

  function openRun(run: WritingRunRecord = activeRun as WritingRunRecord) {
    if (!run) {
      return;
    }
    window.history.replaceState(null, "", `/?runId=${encodeURIComponent(run.id)}&stage=${stageForRun(run)}`);
    applyRun(run);
    setCenterMode("editor");
  }

  function toggleRunDetails(run: WritingRunRecord) {
    if (expandedRunId === run.id) {
      setExpandedRunId(null);
      return;
    }

    applyRun(run);
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
        isBaselinePackage={isBaselinePackage}
        selectedRuleScope={selectedRuleScope}
        quickIntake={quickIntake}
        spec={spec}
        outputContract={outputContract}
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
        onUpdateQuickIntake={updateQuickIntake}
        onUpdateSpec={updateSpec}
        onUpdateOutputContract={updateOutputContract}
        onSetActiveSource={setActiveSource}
        onClearActiveSource={() => setActiveSource(null)}
        onRemoveRuleScopeItem={removeRuleScopeItem}
        onGenerateRuleScope={generateRuleScopePreview}
        onStartJobSpec={startJobSpec}
        onRerunPrecheck={rerunPrecheck}
        onConfirmPrecheck={confirmPrecheck}
        canVisitStage={canVisitStage}
        onVisitStage={visitStage}
        onSelectCandidate={setSelectedCandidateId}
        onSelectFinalCandidate={selectFinalizedCandidate}
        onRecordFeedback={activeRun ? recordFeedback : undefined}
        onRunGenerationBatch={runGenerationBatch}
        onEnterFinalize={enterFinalize}
        onBackToReview={() => setStage("review")}
        onExportDoc={exportFinalizedDoc}
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
              jobView={jobView}
              counts={viewCounts}
              onChangeView={changeJobView}
              onNewJob={startNewJobDraft}
            />
          ) : (
            <LinearSidebar
              jobView={jobView}
              counts={viewCounts}
              onChangeView={changeJobView}
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
            stageBadge={stageCopy[stage].badge}
            activeRun={activeRun}
            runtimeBusy={runtimeBusy}
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
        写作规则范围尚未生成。它是进入输入契约前的临时规则范围，只包含结构、语气、禁忌和检查点。
      </section>
    );
  }

  const visibleItems = ruleScope.items.slice(0, 3);
  const hiddenItems = ruleScope.items.slice(3);

  return (
    <section className="space-y-3 rounded-lg border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">写作规则范围</div>
          <p className="mt-1 text-sm text-muted-foreground">
            轻量规则范围，默认只展示关键 3 条；提炼评分：{ruleScope.eval.score} / 100；来源 {ruleScope.source}。
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
      <WarningCallout>{ruleScope.warning}</WarningCallout>
      <div className="grid gap-2">
        {visibleItems.map((item) => (
          <div key={item.id} className="rounded-lg border bg-zinc-50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{scopeKindLabel[item.kind]}</Badge>
                  <Badge variant="outline">{confidenceLabel[item.confidence]}</Badge>
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
                    <Badge variant="secondary">{scopeKindLabel[item.kind]}</Badge>
                    <Badge variant="outline">{confidenceLabel[item.confidence]}</Badge>
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
              </button>
            </div>
          );
        })}
      </div>
    </nav>
  );
}

function LinearEditor({
  stage,
  activeRun,
  ruleScope,
  selectedSkillPackage,
  isBaselinePackage,
  selectedRuleScope,
  quickIntake,
  spec,
  outputContract,
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
  onUpdateQuickIntake,
  onUpdateSpec,
  onUpdateOutputContract,
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
}: {
  stage: FlowStage;
  activeRun: WritingRunRecord | null;
  ruleScope: WritingRuleScopeRecord | null;
  selectedSkillPackage: (typeof skillPackageOptions)[number];
  isBaselinePackage: boolean;
  selectedRuleScope: string;
  quickIntake: QuickIntake;
  spec: JobSpec;
  outputContract: OutputContract;
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
  onUpdateQuickIntake: (field: keyof QuickIntake, value: string) => void;
  onUpdateSpec: (field: keyof JobSpec, value: string) => void;
  onUpdateOutputContract: (field: keyof OutputContract, value: string) => void;
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
}) {
  const [precheckTab, setPrecheckTab] = useState("precheck");

  if (stage === "intake") {
    return (
      <EditorStageShell stage={stage} canVisitStage={canVisitStage} onVisitStage={onVisitStage}>
        <section className="flex min-h-[720px] flex-col rounded-lg border bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">新建任务草稿</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                单入口输入一句想法或粘贴材料，先生成轻量写作规则范围。
              </p>
            </div>
            <Badge variant="outline">{isBaselinePackage ? "基线" : selectedSkillPackage.category}</Badge>
          </div>
          <div className="mt-4 flex flex-1 flex-col gap-3">
            <Textarea
              value={quickIntake.raw}
              onChange={(event) => onUpdateQuickIntake("raw", event.target.value)}
              className="min-h-32"
              placeholder="一句话想法、会议记录、视频转写、参考片段或底稿。"
            />
            <Textarea
              value={quickIntake.referencePaste}
              onChange={(event) => onUpdateQuickIntake("referencePaste", event.target.value)}
              className="min-h-24"
              placeholder="可选：粘贴参考文本。没有参考文本时只生成基线规则范围。"
            />
            <RuleScopePreview ruleScope={ruleScope} onRemoveItem={onRemoveRuleScopeItem} />
            <div className="mt-auto flex items-center justify-end gap-2 border-t pt-3">
              <Button variant="outline" onClick={onGenerateRuleScope} disabled={runtimeBusy}>
                {runtimeTask === "scope_extraction" ? "规则提炼中..." : "生成规则范围"}
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
              <h2 className="text-base font-semibold">输入契约</h2>
              <p className="mt-1 text-sm text-muted-foreground">修改输入后需要重新运行生成前检查。</p>
            </div>
            <Field label="标题 / 任务" sourceKey="intent" activeSource={activeSource} onActivate={onSetActiveSource} onClear={onClearActiveSource}>
              <Input value={spec.title} onChange={(event) => onUpdateSpec("title", event.target.value)} />
            </Field>
            <Field label="目标" sourceKey="intent" activeSource={activeSource} onActivate={onSetActiveSource} onClear={onClearActiveSource}>
              <Textarea value={spec.goal} onChange={(event) => onUpdateSpec("goal", event.target.value)} className="min-h-20" />
            </Field>
            <Field label="底稿 / 原始素材" sourceKey="evidence" activeSource={activeSource} onActivate={onSetActiveSource} onClear={onClearActiveSource}>
              <Textarea value={spec.source} onChange={(event) => onUpdateSpec("source", event.target.value)} className="min-h-28" />
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="产物类型" sourceKey="output" activeSource={activeSource} onActivate={onSetActiveSource} onClear={onClearActiveSource}>
                <Input value={outputContract.artifactType} onChange={(event) => onUpdateOutputContract("artifactType", event.target.value)} />
              </Field>
              <Field label="长度范围" sourceKey="output" activeSource={activeSource} onActivate={onSetActiveSource} onClear={onClearActiveSource}>
                <Input value={outputContract.lengthRange} onChange={(event) => onUpdateOutputContract("lengthRange", event.target.value)} />
              </Field>
            </div>
            <Field label="写法参考" sourceKey="style" activeSource={activeSource} onActivate={onSetActiveSource} onClear={onClearActiveSource}>
              <Textarea value={spec.writingReference} onChange={(event) => onUpdateSpec("writingReference", event.target.value)} className="min-h-24" />
            </Field>
            <Field label="评审偏好" sourceKey="review" activeSource={activeSource} onActivate={onSetActiveSource} onClear={onClearActiveSource}>
              <Textarea value={spec.reviewPreference} onChange={(event) => onUpdateSpec("reviewPreference", event.target.value)} className="min-h-24" />
            </Field>
          </div>

          <aside className="flex min-w-0 flex-col">
            <Tabs value={precheckTab} onValueChange={setPrecheckTab} className="min-h-0 flex flex-1 flex-col overflow-hidden rounded-lg border bg-white">
              <div className="border-b px-4 py-3">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="precheck">生成前检查</TabsTrigger>
                  <TabsTrigger value="eval">评分口径</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="precheck" className="m-0 min-h-0 flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-base font-semibold">生成前检查</h2>
                        <p className="mt-1 text-sm text-muted-foreground">检查结果是候选生成前的契约。</p>
                      </div>
                      <Badge variant="outline">{precheckTrace ? `${precheckTrace.provider}` : "waiting"}</Badge>
                    </div>
                    <WarningCallout>
                      {activeRun?.precheckRun.warning ?? "LLM 会按基线结构拆解输入；确认前不能进入生成。"}
                    </WarningCallout>
                    {activeRun ? (
                      <div className="mt-3 flex flex-col gap-3">
                        <InfoRow label="内容摘要" value={activeRun.precheckRun.contentBrief} />
                        <InfoRow label="依据边界" value={activeRun.precheckRun.groundingBrief} />
                        <details className="rounded-lg border bg-zinc-50 p-3 text-sm">
                          <summary className="cursor-pointer font-medium">规则与风险</summary>
                          <div className="mt-3 flex flex-col gap-2">
                            {activeRun.precheckRun.writingRulesCandidate.slice(0, 5).map((rule, index) => (
                              <div key={`${rule}-${index}`} className="rounded-md border bg-white p-2">{rule}</div>
                            ))}
                          </div>
                        </details>
                      </div>
                    ) : null}
                  </div>
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
  const diagnosticsHref = activeRun ? frameworkDiagnosticsHref(activeRun, stage, selectedDraft) : "/framework";
  const traceCount = activeRun?.llmTraces?.length ?? 0;
  const langfuseTraceCount = activeRun?.llmTraces?.filter((trace) => trace.langfuseTraceId).length ?? 0;
  const fullPayloadCount =
    activeRun?.llmTraces?.filter((trace) => trace.inputPayload !== undefined && trace.outputPayload !== undefined).length ?? 0;
  const recentTraces = (activeRun?.llmTraces ?? []).slice().reverse().slice(0, 5);

  return (
	    <aside className="flex h-full min-h-0 flex-col bg-[#fbfaf6]">
	      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
	        <div className="min-w-0">
	          <div className="text-sm font-semibold">上下文面板</div>
	          <div className="mt-1 truncate text-xs text-muted-foreground">
	            {activeRun ? activeRun.id : "未选择任务"}
	          </div>
	        </div>
          <Button asChild variant="outline" size="sm" className="h-8 shrink-0">
            <Link href={diagnosticsHref}>观测</Link>
          </Button>
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
              <div className="flex flex-col gap-4 p-4">
                <section className="rounded-lg border bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="line-clamp-2 text-sm font-semibold">{activeRun.jobSpec.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{runStateLabel(activeRun)}</div>
                    </div>
                    <Badge variant="outline">{activeRun.candidates.length} 个候选</Badge>
                  </div>
                  <div className="mt-3 grid gap-2">
                    <Button variant="outline" size="sm" onClick={() => onStageChange("precheck")}>
                      检查
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!activeRun.candidates.length}
                      onClick={() => onStageChange("review")}
                    >
                      评审
                    </Button>
                  </div>
                </section>

                {selectedDraft ? (
                  <section className="rounded-lg border bg-white p-3">
                    <div className="text-xs font-medium text-muted-foreground">已选候选</div>
                    <div className="mt-2 line-clamp-2 text-sm font-semibold">{selectedDraft.title}</div>
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{selectedDraft.version}</span>
                      <span>{selectedDraft.total}</span>
                    </div>
                  </section>
                ) : null}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="next" className="m-0 min-h-0 flex-1">
            <ScrollArea className="h-full">
              <div className="flex flex-col gap-4 p-4">
                {stage === "review" ? (
                  <DecisionQueuePanel
                    run={activeRun}
                    latestGenerationRunId={latestGenerationRunId}
                    runtimeBusy={runtimeBusy}
                    disabled={runtimeBusy}
                    onRunGenerationBatch={onRunGenerationBatch}
                    onDeleteFeedback={onDeleteFeedback}
                  />
                ) : (
                  <section className="rounded-lg border bg-white p-3">
                    <div className="text-sm font-semibold">当前下一步</div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {stage === "intake"
                        ? "先生成写作规则范围，再进入生成前检查。"
                        : stage === "precheck"
                          ? "确认检查结果后生成候选。"
                          : "选择定稿候选并导出本次产物。"}
                    </p>
                    <div className="mt-3 grid gap-2">
                      <Button variant="outline" size="sm" onClick={() => onStageChange("precheck")}>
                        打开检查
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!activeRun.candidates.length}
                        onClick={() => onStageChange("review")}
                      >
                        打开评审
                      </Button>
                    </div>
                  </section>
                )}
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
                          点击展开查看最近模型调用；完整输入输出在详情页。
                        </p>
                      </div>
                      <Badge variant={traceCount > 0 ? "secondary" : "outline"}>{traceCount}</Badge>
                    </div>
                  </summary>
                  <div className="mt-3 grid gap-2 text-xs">
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
                    {recentTraces.map((trace) => (
                      <Link
                        key={trace.id}
                        href={frameworkDiagnosticsHref(activeRun, stage, selectedDraft, trace)}
                        className="block rounded-md border bg-zinc-50 px-2 py-2 text-xs transition hover:border-zinc-500 hover:bg-white"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium">{trace.nodeType}</span>
                          <Badge variant={trace.status === "complete" ? "secondary" : "destructive"}>
                            {trace.status === "complete" ? "完成" : "失败"}
                          </Badge>
                        </div>
                        <div className="mt-1 truncate text-muted-foreground">
                          {trace.provider} / {trace.model}
                        </div>
                      </Link>
                    ))}
                    {!recentTraces.length ? (
                      <div className="rounded-md border border-dashed bg-zinc-50 p-2 text-xs text-muted-foreground">
                        当前任务还没有模型调用。
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
	      onFocusCapture={() => sourceKey && onActivate?.(sourceKey)}
	      onBlurCapture={onClear}
	    >
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
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
  onExportDoc: (candidate: CandidateRecord) => Promise<void> | void;
}) {
  const selectedDraft = drafts.find((draft) => draft.id === selectedCandidateId) ?? drafts[0];

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
                <h3 className="mt-3 line-clamp-2 break-words text-base font-semibold [overflow-wrap:anywhere]">{draft.title}</h3>
                <p className="mt-2 line-clamp-3 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">{draft.summary}</p>
                <div className="mt-4 flex-1 overflow-hidden rounded-lg border bg-white p-3">
                  <p className="line-clamp-6 break-words text-sm leading-6 text-zinc-800 [overflow-wrap:anywhere]">{draft.excerpt}</p>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{active ? "已选为本次定稿" : "点击选择"}</span>
                  {active ? <CheckCircle2 className="size-4 text-zinc-900" /> : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
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
  const [selectionWasTruncated, setSelectionWasTruncated] = useState(false);
  const [readingTab, setReadingTab] = useState("body");
  const selectedFeedbacks = feedback.filter(
    (item) => item.candidateId === selectedDraft.id && item.kind === "selection",
  );

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
                <div className="mt-2 line-clamp-2 break-words text-sm font-medium text-zinc-950 [overflow-wrap:anywhere]">
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
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="font-mono">
                  {selectedDraft.version || `版本 ${selectedIndex + 1}`}
                </Badge>
                {selectedIndex === bestDraftIndex ? <Badge variant="outline">当前最高分</Badge> : null}
                <Badge variant="outline">长文阅读器</Badge>
              </div>
              <h3 className="mt-2 line-clamp-2 break-words text-lg font-semibold [overflow-wrap:anywhere]">{selectedDraft.title}</h3>
              <p className="mt-1 line-clamp-2 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">{selectedDraft.summary}</p>
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

        <div className="flex flex-col gap-4 p-4">
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
                      <div className="text-xs font-medium text-muted-foreground">Summary</div>
                      <p className="mt-2 text-sm leading-6 text-zinc-900">{selectedDraft.summary}</p>
                    </div>
                    <div className="rounded-lg border bg-zinc-50 p-3">
                      <div className="text-xs font-medium text-muted-foreground">Rationale</div>
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
                      <div className="text-sm font-semibold">自动评分</div>
                      <Badge variant="outline" className="bg-white">后台评分口径</Badge>
                    </div>
                    <div className="grid gap-3 md:grid-cols-4">
                      <Score label="基础质量" source="自动评分" value={selectedDraft.breakdown.quality} />
                      <Score label="任务匹配" source="自动评分" value={selectedDraft.breakdown.fit} />
                      <Score label="风格偏好" source="自动评分" value={selectedDraft.breakdown.style} />
                      <Score label="风险扣分" source="自动评分" value={selectedDraft.breakdown.risk} danger />
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
