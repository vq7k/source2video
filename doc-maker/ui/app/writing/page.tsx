"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Copy,
  ChevronRight,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  compileWritingRulePatch,
  confirmWritingRun,
  createWritingRunRecord,
  finalizeWritingRunRecord,
  listWritingRuns,
  recordWritingFeedback,
  recordWritingTopicContext,
  runWritingGenerationBatch,
} from "@/lib/writing-run-client";
import {
  buildWritingTopics,
  type WritingTopicView,
} from "@doc-maker/writing-domain/topic-view";
import type {
  CandidateRecord,
  CreateWritingRunInput,
  HumanFeedbackInput,
  WritingRunRecord,
} from "@doc-maker/writing-domain/types";
import { cn } from "@/lib/utils";

const BASELINE_SKILL_PACKAGE: CreateWritingRunInput["skillPackage"] = {
  id: "baseline-no-package",
  category: "本次文本",
  version: "Baseline / No Published Rule Package",
  status: "baseline mode",
};

const BASELINE_OUTPUT_PROFILE: CreateWritingRunInput["outputProfile"] = {
  name: "文本产物",
  artifacts: ["text_artifact"],
};

const EMPTY_OUTPUT_CONTRACT: NonNullable<CreateWritingRunInput["outputContract"]> = {
  artifactType: "",
  lengthRange: "",
  structure: "",
  formatRules: "",
  groundingRules: "",
  specialHandling: "",
  downstreamHandoff: "",
};

const L1_WORKBENCH_GOAL =
  "围绕本次输入生成一个可直接阅读的文本版本；优先明确核心判断，避免扩散到新主题。";
const L1_CURRENT_TOPIC_IDS_STORAGE_KEY = "doc-marker:l1-current-topic-ids:v1";
const L1_LEGACY_CURRENT_TOPIC_IDS_STORAGE_KEY = "doc-marker:l1-current-session:v1";
const L1_LEGACY_OLD_TOPIC_IDS_STORAGE_KEY = "doc-marker:l1-writing-session:v1";
const L1_LEGACY_ACTIVE_SESSION_STORAGE_KEY = "doc-marker:l1-active-session-id:v1";
const L1_LEGACY_LAST_SESSION_STORAGE_KEY = "doc-marker:l1-last-session:v1";
const L1_ROUND_CUE_DISMISSED_STORAGE_KEY = "doc-marker:l1-round-cue-dismissed:v1";
const INPUT_EXAMPLES = [
  "解释：为什么 RAG 不适合实时数据？",
  "整理：把会议记录整理成一段结论",
  "生成：根据这段材料写一段提示词",
];

type RuntimeAction = "generate" | "refine" | null;
type FeedbackDirection = "closer" | "specific" | "structure" | "tone" | "angle";
type SelectedFeedbackDirection = FeedbackDirection | null;
type L1TopicListSnapshot = {
  topicIds: string[];
};

const FEEDBACK_DIRECTIONS: Record<
  FeedbackDirection,
  {
    label: string;
    businessReason: NonNullable<HumanFeedbackInput["businessReason"]>;
    likelyCause: NonNullable<HumanFeedbackInput["likelyCause"]>;
    issue: string;
    expected: string;
  }
> = {
  closer: {
    label: "保留方向",
    businessReason: "正向样本",
    likelyCause: "style",
    issue: "当前版本方向接近，但还需要进一步减少不确定表达。",
    expected: "保留当前结构和语气优点，下一轮继续收敛。",
  },
  specific: {
    label: "更具体",
    businessReason: "表达冗余",
    likelyCause: "prompt",
    issue: "内容仍偏泛，需要更多具体判断和可追问依据。",
    expected: "下一轮减少空泛铺垫，每段给出更明确的判断和依据。",
  },
  structure: {
    label: "调结构",
    businessReason: "结构问题",
    likelyCause: "schema",
    issue: "组织顺序还不够清楚，阅读路径不够稳定。",
    expected: "下一轮先给结论，再按机制、例子、边界展开。",
  },
  tone: {
    label: "调语气",
    businessReason: "风格不对",
    likelyCause: "style",
    issue: "语气需要更克制，避免营销腔或过度修辞。",
    expected: "下一轮使用清晰、中性、可追问的表达。",
  },
  angle: {
    label: "换个角度",
    businessReason: "结构问题",
    likelyCause: "prompt",
    issue: "当前组织角度不够理想，需要探索另一种表达路径。",
    expected: "下一轮降低当前表达路径权重，生成差异更明显的新角度。",
  },
};

function titleFromInput(input: string) {
  const firstLine = input.split("\n").find((line) => line.trim())?.trim() ?? "";
  if (!firstLine) {
    return "未命名主题";
  }

  return firstLine.length > 52 ? `${firstLine.slice(0, 52)}...` : firstLine;
}

function formatTopicUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "时间未知";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function jobSpecFromInput(input: string): CreateWritingRunInput["jobSpec"] {
  return {
    title: titleFromInput(input),
    goal: L1_WORKBENCH_GOAL,
    source: input,
    writingReference: "",
    reviewPreference: "",
  };
}

async function copyTextSafely(text: string) {
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    return copied;
  } catch {
    // Fall through to Clipboard API. Some embedded browsers block execCommand.
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

function candidateEvalResult(run: WritingRunRecord, candidateId: string) {
  return run.evalRun?.candidateResults.find((result) => result.candidateId === candidateId) ?? null;
}

function candidateTone(run: WritingRunRecord, candidate: CandidateRecord) {
  const evalResult = candidateEvalResult(run, candidate.id);
  const topDimension = evalResult
    ? evalResult.attribution
        .filter((item) => item.score > 0)
        .sort((left, right) => right.score - left.score)[0]
    : null;

  if (topDimension) {
    return topDimension.dimension;
  }

  return candidate.total > 0 ? "历史评分" : "待评分";
}

function candidateScore(run: WritingRunRecord, candidate: CandidateRecord) {
  const evalResult = candidateEvalResult(run, candidate.id);
  if (evalResult) {
    return evalResult.total;
  }

  return typeof candidate.total === "number" && candidate.total > 0 ? candidate.total : null;
}

function candidateSignal(run: WritingRunRecord, candidate: CandidateRecord) {
  const evalResult = candidateEvalResult(run, candidate.id);
  return evalResult?.strongestSignal || candidate.summary || "可展开阅读全文";
}

function uniqueRunIds(ids: string[]) {
  return Array.from(new Set(ids.filter((id) => typeof id === "string" && id.trim().length > 0)));
}

function normalizeTopicIds(parsed: unknown): string[] {
  if (!parsed) {
    return [];
  }

  if (Array.isArray(parsed)) {
    return uniqueRunIds(parsed);
  }

  if (typeof parsed === "object" && "topicIds" in parsed) {
    const snapshot = parsed as Partial<L1TopicListSnapshot>;
    return uniqueRunIds(Array.isArray(snapshot.topicIds) ? snapshot.topicIds : []);
  }

  return [];
}

function readStoredTopicIds(storage: Storage, key: string): string[] {
  try {
    const raw = storage.getItem(key);
    if (!raw) {
      return [];
    }
    return normalizeTopicIds(JSON.parse(raw));
  } catch {
    return [];
  }
}

function clearStoredTopicIds(storage: Storage) {
  storage.removeItem(L1_CURRENT_TOPIC_IDS_STORAGE_KEY);
  storage.removeItem(L1_LEGACY_CURRENT_TOPIC_IDS_STORAGE_KEY);
  storage.removeItem(L1_LEGACY_OLD_TOPIC_IDS_STORAGE_KEY);
}

function shouldRestoreCurrentTopicsFromStorage() {
  const navigation = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  return navigation?.type === "reload";
}

export default function LightweightWritingWorkbenchPage() {
  const [runs, setRuns] = useState<WritingRunRecord[]>([]);
  const [currentTopicIds, setCurrentTopicIds] = useState<string[]>([]);
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [quickInput, setQuickInput] = useState("");
  const [expandedCandidateId, setExpandedCandidateId] = useState<string | null>(null);
  const [runtimeAction, setRuntimeAction] = useState<RuntimeAction>(null);
  const [feedbackDirection, setFeedbackDirection] = useState<SelectedFeedbackDirection>(null);
  const [supplementContext, setSupplementContext] = useState("");
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [streamLines, setStreamLines] = useState<string[]>([]);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [dismissedRoundCueIds, setDismissedRoundCueIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [copied, setCopied] = useState(false);
  const streamTimersRef = useRef<number[]>([]);
  const initialLoadStartedRef = useRef(false);
  const currentTopicIdsLoadedRef = useRef(false);
  const dismissedRoundCueIdsLoadedRef = useRef(false);

  const loadWorkspace = useCallback(async () => {
    setLoadingRuns(true);
    setError(null);
    try {
      const { runs: nextRuns } = await listWritingRuns();
      setRuns(nextRuns);

      const knownRunIds = new Set(nextRuns.map((run) => run.id));
      const shouldRestoreCurrentTopics = shouldRestoreCurrentTopicsFromStorage();
      if (!shouldRestoreCurrentTopics) {
        clearStoredTopicIds(window.sessionStorage);
      }

      const storedTopicIds = shouldRestoreCurrentTopics
        ? readStoredTopicIds(window.sessionStorage, L1_CURRENT_TOPIC_IDS_STORAGE_KEY)
        : [];
      const legacyTopicIds = storedTopicIds.length
        ? []
        : shouldRestoreCurrentTopics
          ? [
              ...readStoredTopicIds(window.sessionStorage, L1_LEGACY_CURRENT_TOPIC_IDS_STORAGE_KEY),
              ...readStoredTopicIds(window.sessionStorage, L1_LEGACY_OLD_TOPIC_IDS_STORAGE_KEY),
            ]
          : [];
      const nextCurrentTopicIds = uniqueRunIds([...storedTopicIds, ...legacyTopicIds]).filter((id) =>
        knownRunIds.has(id),
      );

      window.localStorage.removeItem(L1_LEGACY_ACTIVE_SESSION_STORAGE_KEY);
      window.localStorage.removeItem(L1_LEGACY_LAST_SESSION_STORAGE_KEY);
      window.sessionStorage.removeItem(L1_LEGACY_CURRENT_TOPIC_IDS_STORAGE_KEY);
      window.sessionStorage.removeItem(L1_LEGACY_OLD_TOPIC_IDS_STORAGE_KEY);
      setCurrentTopicIds(nextCurrentTopicIds);
      setActiveTopicId((current) =>
        current && nextCurrentTopicIds.includes(current) ? current : nextCurrentTopicIds[0] ?? null,
      );
      setSelectedRound(null);
      setExpandedCandidateId(null);
      setSupplementContext("");
      currentTopicIdsLoadedRef.current = true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "加载写作记录失败");
    } finally {
      setLoadingRuns(false);
    }
  }, []);

  useEffect(() => {
    if (initialLoadStartedRef.current) {
      return;
    }
    initialLoadStartedRef.current = true;
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    setDismissedRoundCueIds(readStoredTopicIds(window.localStorage, L1_ROUND_CUE_DISMISSED_STORAGE_KEY));
    dismissedRoundCueIdsLoadedRef.current = true;
  }, []);

  useEffect(() => {
    return () => {
      for (const timer of streamTimersRef.current) {
        window.clearTimeout(timer);
      }
      streamTimersRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!currentTopicIdsLoadedRef.current) {
      return;
    }
    window.sessionStorage.setItem(L1_CURRENT_TOPIC_IDS_STORAGE_KEY, JSON.stringify(currentTopicIds));
  }, [currentTopicIds]);

  useEffect(() => {
    if (!dismissedRoundCueIdsLoadedRef.current) {
      return;
    }
    window.localStorage.setItem(
      L1_ROUND_CUE_DISMISSED_STORAGE_KEY,
      JSON.stringify(dismissedRoundCueIds),
    );
  }, [dismissedRoundCueIds]);

  const topics = useMemo(() => buildWritingTopics(runs), [runs]);
  const currentTopicIdSet = useMemo(() => new Set(currentTopicIds), [currentTopicIds]);
  const currentTopics = useMemo(
    () =>
      currentTopicIds
        .map((id) => topics.find((topic) => topic.id === id))
        .filter((topic): topic is WritingTopicView => Boolean(topic)),
    [currentTopicIds, topics],
  );
  const pastTopics = useMemo(
    () => topics.filter((topic) => !currentTopicIdSet.has(topic.id)),
    [currentTopicIdSet, topics],
  );
  const activeTopic = activeTopicId
    ? topics.find((topic) => topic.id === activeTopicId) ?? null
    : null;
  const visibleRound =
    activeTopic?.rounds.find((round) => round.round === selectedRound) ??
    activeTopic?.currentRound ??
    null;
  const busy = runtimeAction !== null;
  const showTopicComposer = !activeTopic?.recommendedCandidate;
  const showInputExamples = showTopicComposer && quickInput.trim().length === 0;

  function startNewTopic() {
    setActiveTopicId(null);
    setSelectedRound(null);
    setExpandedCandidateId(null);
    setSupplementContext("");
    setFeedbackDirection(null);
    setQuickInput("");
    setError(null);
  }

  function addTopicToCurrent(topicId: string) {
    setCurrentTopicIds((current) => [topicId, ...current.filter((id) => id !== topicId)]);
  }

  function selectTopic(topic: WritingTopicView, options: { bringIntoCurrent?: boolean } = {}) {
    if (options.bringIntoCurrent || !currentTopicIdSet.has(topic.id)) {
      addTopicToCurrent(topic.id);
    }
    setActiveTopicId(topic.id);
    setSelectedRound(topic.currentRound?.round ?? null);
    setExpandedCandidateId(null);
    setSupplementContext("");
    setFeedbackDirection(null);
    setError(null);
  }

  function dismissRoundCue(topicId: string) {
    setDismissedRoundCueIds((current) => uniqueRunIds([...current, topicId]));
  }

  function clearStreamTimers() {
    for (const timer of streamTimersRef.current) {
      window.clearTimeout(timer);
    }
    streamTimersRef.current = [];
  }

  function appendStreamLine(line: string) {
    setStreamLines((current) => [...current, line].slice(-5));
  }

  function beginStream(action: Exclude<RuntimeAction, null>) {
    clearStreamTimers();
    const lines =
      action === "generate"
        ? [
            "收到你的输入，正在理解这次要写什么。",
            "正在确认主题边界，避免跑到别的问题上。",
            "正在写出 3 个可比较版本。",
            "正在比较可读性和任务匹配度。",
          ]
        : [
            "收到你的反馈，正在保留当前主题。",
            "正在把补充要求合并进下一轮。",
            "正在重新写出 3 个可比较版本。",
            "正在比较这一轮是否更接近目标。",
          ];
    setStreamLines([lines[0]]);
    lines.slice(1).forEach((line, index) => {
      const timer = window.setTimeout(() => appendStreamLine(line), 900 + index * 1400);
      streamTimersRef.current.push(timer);
    });
  }

  function upsertRun(run: WritingRunRecord) {
    setRuns((current) => {
      const without = current.filter((item) => item.id !== run.id);
      return [run, ...without];
    });
    addTopicToCurrent(run.id);
    setActiveTopicId(run.id);
    setSelectedRound(run.round ?? null);
  }

  async function generateTopic() {
    const raw = quickInput.trim();
    if (!raw) {
      setError("先输入一个主题、想法或材料。");
      return;
    }

    setRuntimeAction("generate");
    beginStream("generate");
    setError(null);
    try {
      const created = await createWritingRunRecord({
        quickIntake: raw,
        referencePaste: "",
        skillPackage: BASELINE_SKILL_PACKAGE,
        outputProfile: BASELINE_OUTPUT_PROFILE,
        outputContract: EMPTY_OUTPUT_CONTRACT,
        jobSpec: jobSpecFromInput(raw),
      });
      appendStreamLine("主题理解完成，开始写 3 个版本。");
      const confirmed = await confirmWritingRun(created.run.id);
      appendStreamLine("3 个版本已写好，正在整理结果。");
      upsertRun(confirmed.run);
      setQuickInput("");
      setExpandedCandidateId(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "生成失败");
    } finally {
      clearStreamTimers();
      setRuntimeAction(null);
    }
  }

  async function continueTopic() {
    if (!activeTopic?.recommendedCandidate) {
      setError("当前主题还没有可继续迭代的候选版本。");
      return;
    }

    const candidate = activeTopic.recommendedCandidate;
    const context = supplementContext.trim();
    const direction = feedbackDirection ? FEEDBACK_DIRECTIONS[feedbackDirection] : null;

    setRuntimeAction("refine");
    beginStream("refine");
    setError(null);
    try {
      if (!direction && !context) {
        appendStreamLine("没有新增要求，将按当前方向再写一轮。");
        const generated = await runWritingGenerationBatch(activeTopic.id, {
          candidateCount: 3,
          patchIds: [],
        });
        appendStreamLine("新一轮已完成，上一轮会保留在时间线里。");
        upsertRun(generated.run);
        setExpandedCandidateId(null);
        return;
      }

      const contexted = context
        ? await recordWritingTopicContext(activeTopic.id, { text: context, source: "user" })
        : { run: activeTopic.run };
      if (context) {
        appendStreamLine("补充要求已收到，本轮会优先遵守。");
      }
      const feedback: HumanFeedbackInput = {
        candidateId: candidate.id,
        kind: "selection",
        verdict: direction?.businessReason === "正向样本" ? "liked" : "rewrite",
        businessReason: direction?.businessReason,
        likelyCause: direction?.likelyCause,
        quote: candidate.title,
        issue: context || direction?.issue,
        expected: context || direction?.expected,
        confidence: "medium",
        note: direction
          ? `文本生成：用户选择再来一轮；反馈方向：${direction.label}${context ? `；补充要求：${context}` : ""}。`
          : `文本生成：用户选择再来一轮；补充要求：${context}。`,
      };
      const recorded = await recordWritingFeedback(contexted.run.id, feedback);
      appendStreamLine("反馈已记录，正在转成下一轮写作方向。");
      const patched = await compileWritingRulePatch(recorded.run.id, { candidateId: candidate.id });
      appendStreamLine("方向已更新，开始写新一轮 3 个版本。");
      const generated = await runWritingGenerationBatch(patched.run.id, { candidateCount: 3 });
      appendStreamLine("新一轮已完成，上一轮会保留在时间线里。");
      upsertRun(generated.run);
      setExpandedCandidateId(null);
      setSupplementContext("");
      setFeedbackDirection(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "继续迭代失败");
    } finally {
      clearStreamTimers();
      setRuntimeAction(null);
    }
  }

  async function finalizeTopic(candidate: CandidateRecord) {
    if (!activeTopic) {
      setError("当前主题还没有可标为最终的版本。");
      return;
    }

    setError(null);
    try {
      const finalized = await finalizeWritingRunRecord(activeTopic.id, {
        candidateId: candidate.id,
      });
      upsertRun(finalized.run);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "标为最终失败");
    }
  }

  async function copyCandidate(candidate: CandidateRecord) {
    const ok = await copyTextSafely(candidate.excerpt);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } else {
      setError("复制失败，可手动选择文本复制。");
    }
  }

  return (
    <main className="flex h-screen min-h-0 flex-col bg-[#f6f5f1] text-zinc-950">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b bg-[#fbfaf6] px-4">
        <Link href="/writing" className="text-sm font-semibold">
          doc-marker
        </Link>
        <span className="text-xs text-muted-foreground">/</span>
        <span className="text-xs font-medium">文本生成</span>
        <div className="ml-auto flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={startNewTopic}>
            <Plus data-icon="inline-start" />
            新建
          </Button>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="px-2 text-xs text-muted-foreground"
            title="查看完整工作区"
            aria-label="打开完整工作区"
          >
            <Link href="/">全貌</Link>
          </Button>
          {activeTopic ? (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="px-2 text-xs text-muted-foreground"
              title="查看调用细节"
              aria-label="打开调用细节"
            >
              <Link href={`/framework?runId=${activeTopic.id}`}>观测</Link>
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="px-2 text-xs text-muted-foreground"
              disabled
              title="先生成或选择一条记录"
              aria-label="调用细节需要先选择记录"
            >
              观测
            </Button>
          )}
        </div>
      </header>

      <div
        className={cn(
          "grid min-h-0 flex-1 grid-cols-1",
          leftCollapsed
            ? "lg:grid-cols-[64px_minmax(0,1fr)]"
            : "lg:grid-cols-[280px_minmax(0,1fr)]",
        )}
      >
        <aside className="hidden min-h-0 border-r bg-[#efeee9] lg:flex lg:flex-col">
          <div className={cn("border-b", leftCollapsed ? "p-2" : "p-4")}>
            <div
              className={cn(
                "flex items-start gap-2",
                leftCollapsed ? "justify-center" : "justify-between",
              )}
            >
              {leftCollapsed ? null : (
                <div>
                  <div className="text-sm font-semibold">本次</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    当前页签里的记录；关闭页签后清空，记录不会丢。
                  </div>
                </div>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={leftCollapsed ? "展开左侧主题栏" : "收起左侧主题栏"}
                title={leftCollapsed ? "展开主题栏" : "收起主题栏"}
                onClick={() => setLeftCollapsed((value) => !value)}
              >
                {leftCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
              </Button>
            </div>
          </div>
          {!leftCollapsed ? (
            <div className="border-b p-3">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground transition hover:bg-white/60"
                onClick={() => setHistoryOpen((value) => !value)}
              >
                <span className="flex items-center gap-1.5">
                  <ChevronRight
                    className={cn("size-3.5 transition-transform", historyOpen && "rotate-90")}
                  />
                  以往
                </span>
                <Badge variant="secondary">{pastTopics.length}</Badge>
              </button>
              {historyOpen ? (
                <div className="mt-2 flex max-h-44 flex-col gap-2 overflow-y-auto pr-1">
                  {pastTopics.length ? (
                    pastTopics.map((topic) => {
                      const finalized = Boolean(topic.run.finalizedCandidateId);
                      return (
                        <button
                          key={topic.id}
                          type="button"
                          className={cn(
                            "rounded-md border px-3 py-2 text-left transition hover:bg-white/80",
                            "border-transparent bg-white/45",
                          )}
                          onClick={() => selectTopic(topic, { bringIntoCurrent: true })}
                        >
                          <div className="flex items-start gap-2">
                            <div className="line-clamp-1 min-w-0 flex-1 text-sm font-semibold">
                              {topic.title}
                            </div>
                            {finalized ? (
                              <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                            ) : null}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            <span>点开后加入本次</span>
                            <span>最后 {formatTopicUpdatedAt(topic.updatedAt)}</span>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="rounded-md border border-dashed bg-white/50 px-3 py-3 text-sm text-muted-foreground">
                      还没有以往记录。
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
          {leftCollapsed ? (
            <div className="flex min-h-0 flex-1 flex-col items-center gap-2 p-2">
              {currentTopics.length ? (
                currentTopics.map((topic, index) => {
                  const active = topic.id === activeTopicId;
                  const finalized = Boolean(topic.run.finalizedCandidateId);
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      title={`${topic.title}${finalized ? " · 已标最终" : ""}`}
                      aria-label={topic.title}
                      className={cn(
                        "relative flex size-10 items-center justify-center rounded-md border text-xs font-semibold transition",
                        active
                          ? "border-zinc-900 bg-white text-zinc-950"
                          : "border-transparent text-muted-foreground hover:bg-white/70",
                      )}
                      onClick={() => selectTopic(topic)}
                    >
                      T{currentTopics.length - index}
                      {finalized ? (
                        <Check className="absolute right-0.5 top-0.5 size-3 text-emerald-600" />
                      ) : null}
                    </button>
                  );
                })
              ) : (
                <div
                  className="flex size-10 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground"
                  title="生成后出现记录"
                >
                  T
                </div>
              )}
            </div>
          ) : (
            <ScrollArea className="min-h-0 flex-1">
              <div className="flex flex-col gap-3 p-3">
                <div>
                  <div className="text-xs font-medium text-muted-foreground">本次记录</div>
                </div>
                {currentTopics.length ? (
                  currentTopics.map((topic) => {
                    const active = topic.id === activeTopicId;
                    const finalized = Boolean(topic.run.finalizedCandidateId);
                    return (
                      <button
                        key={topic.id}
                        type="button"
                        className={cn(
                          "rounded-md border px-3 py-3 text-left transition hover:bg-white/80",
                          active
                            ? "border-zinc-900 bg-white shadow-sm"
                            : "border-transparent bg-white/45",
                        )}
                        onClick={() => selectTopic(topic)}
                      >
                        <div className="flex items-start gap-2">
                          <div className="line-clamp-2 min-w-0 flex-1 text-sm font-semibold">
                            {topic.title}
                          </div>
                          {finalized ? (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
                              <Check className="size-3" />
                              最终
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <span>{topic.roundCount} 轮</span>
                          <span>{topic.run.candidates.length} 版</span>
                          <span>{topic.run.status === "finalized" ? "已标最终" : "可继续"}</span>
                          <span>最后 {formatTopicUpdatedAt(topic.updatedAt)}</span>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-md border border-dashed bg-white/50 px-3 py-4 text-sm text-muted-foreground">
                    生成后，这里显示本次记录。
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </aside>

        <ScrollArea className="min-h-0 bg-white">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-5 py-6">
            {showTopicComposer ? (
              <Card>
                <CardHeader>
                  <CardTitle>输入文本</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={quickInput}
                    onChange={(event) => setQuickInput(event.target.value)}
                    placeholder="例如：为什么 RAG 不适合实时数据？"
                    className="min-h-32 resize-none text-base leading-7"
                  />
                  {showInputExamples ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {INPUT_EXAMPLES.map((example) => (
                        <button
                          key={example}
                          type="button"
                          className="rounded-full border bg-white px-3 py-1.5 text-xs text-muted-foreground transition hover:border-zinc-400 hover:text-zinc-900"
                          onClick={() => setQuickInput(example)}
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
                <CardFooter className="flex items-center justify-end gap-3">
                  <Button onClick={generateTopic} disabled={busy}>
                    {runtimeAction === "generate" ? (
                      <Loader2 data-icon="inline-start" className="animate-spin" />
                    ) : (
                      <Sparkles data-icon="inline-start" />
                    )}
                    生成结果
                  </Button>
                </CardFooter>
              </Card>
            ) : null}

            {error ? (
              <div className="flex items-start justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                <span className="min-w-0 break-words">{error}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => void loadWorkspace()}
                  disabled={loadingRuns}
                >
                  {loadingRuns ? <Loader2 data-icon="inline-start" className="animate-spin" /> : null}
                  重新加载
                </Button>
              </div>
            ) : null}

            {activeTopic ? <TopicContextDisclosure topic={activeTopic} /> : null}

            {runtimeAction ? <RuntimeProgress action={runtimeAction} lines={streamLines} /> : null}

            {!activeTopic?.recommendedCandidate ? (
              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle>{activeTopic ? "等待生成" : "尚未生成"}</CardTitle>
                  <CardDescription>
                    {activeTopic
                      ? "当前记录还没有版本。"
                      : "输入文本后生成；结果会进入本次。"}
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : (
              <TopicResult
                topic={activeTopic}
                visibleRound={visibleRound}
                selectedRound={selectedRound}
                expandedCandidateId={expandedCandidateId}
                copied={copied}
                busy={busy}
                supplementContext={supplementContext}
                onToggleCandidate={setExpandedCandidateId}
                onCopyCandidate={copyCandidate}
                onFinalize={finalizeTopic}
                onRefine={continueTopic}
                feedbackDirection={feedbackDirection}
                onFeedbackDirectionChange={setFeedbackDirection}
                onSelectRound={setSelectedRound}
                onSupplementContextChange={setSupplementContext}
                roundCueDismissed={dismissedRoundCueIds.includes(activeTopic.id)}
                onDismissRoundCue={dismissRoundCue}
              />
            )}
          </div>
        </ScrollArea>
      </div>
    </main>
  );
}

function TopicResult({
  topic,
  visibleRound,
  selectedRound,
  expandedCandidateId,
  copied,
  busy,
  supplementContext,
  feedbackDirection,
  onToggleCandidate,
  onCopyCandidate,
  onFinalize,
  onRefine,
  onFeedbackDirectionChange,
  onSelectRound,
  onSupplementContextChange,
  roundCueDismissed,
  onDismissRoundCue,
}: {
  topic: WritingTopicView;
  visibleRound: NonNullable<WritingTopicView["currentRound"]> | null;
  selectedRound: number | null;
  expandedCandidateId: string | null;
  copied: boolean;
  busy: boolean;
  supplementContext: string;
  feedbackDirection: SelectedFeedbackDirection;
  onToggleCandidate: (candidateId: string | null) => void;
  onCopyCandidate: (candidate: CandidateRecord) => void;
  onFinalize: (candidate: CandidateRecord) => void;
  onRefine: () => void;
  onFeedbackDirectionChange: (direction: SelectedFeedbackDirection) => void;
  onSelectRound: (round: number | null) => void;
  onSupplementContextChange: (value: string) => void;
  roundCueDismissed: boolean;
  onDismissRoundCue: (topicId: string) => void;
}) {
  const recommended = visibleRound?.bestCandidate ?? null;
  if (!recommended) {
    return null;
  }

  const alternatives = visibleRound
    ? visibleRound.candidates.filter((candidate) => candidate.id !== recommended.id)
    : [];
  const isCurrentRound = visibleRound?.round === topic.currentRound?.round;
  const hasRefineSignal = Boolean(feedbackDirection || supplementContext.trim());
  const showFeedbackHint = topic.roundCount >= 2 && topic.feedbackCount === 0 && !hasRefineSignal;
  const isFinalizedCandidate = topic.run.finalizedCandidateId === recommended.id;
  const topicFinalized = topic.run.status === "finalized";
  const recommendedScore = candidateScore(topic.run, recommended);
  const recommendedTone = candidateTone(topic.run, recommended);
  const showRoundCue = topic.roundCount >= 5 && !roundCueDismissed;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>历史结果</CardTitle>
          <CardDescription>
            已生成内容会保留，切换查看不会改写。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {showRoundCue ? (
            <div className="flex w-full flex-wrap items-center justify-between gap-2 rounded-md border bg-[#fbfaf6] px-3 py-2 text-sm text-zinc-700">
              <span>已到第 5 轮，可回看前几轮差异。</span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    onSelectRound(1);
                    onToggleCandidate(null);
                  }}
                >
                  回看第 1 轮
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  aria-label="关闭轮次提示"
                  onClick={() => onDismissRoundCue(topic.id)}
                >
                  关闭
                </Button>
              </div>
            </div>
          ) : null}
          {topic.rounds.slice().reverse().map((round) => {
            const active = (selectedRound ?? topic.currentRound?.round) === round.round;
            const current = round.round === topic.currentRound?.round;
            return (
              <Button
                key={round.round}
                type="button"
                variant={active ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  onSelectRound(round.round);
                  onToggleCandidate(null);
                }}
              >
                第 {round.round} 轮
                {current ? " · 当前" : " · 历史"}
              </Button>
            );
          })}
        </CardContent>
      </Card>

      <Card className="border-zinc-900 shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{isCurrentRound ? "Eval 最高" : "历史最高"}</Badge>
                <Badge variant="secondary">第 {visibleRound?.round ?? topic.roundCount} 轮</Badge>
                {recommendedScore !== null ? (
                  <Badge variant="outline">Eval {recommendedScore}</Badge>
                ) : null}
                <Badge variant="outline">强项：{recommendedTone}</Badge>
                {isFinalizedCandidate ? (
                  <Badge className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                    <Check className="size-3" />
                    最终
                  </Badge>
                ) : (
                  <Badge variant="outline">{isCurrentRound ? "未标记" : "已保留"}</Badge>
                )}
              </div>
              <CardTitle>{recommended.title}</CardTitle>
              <CardDescription>{recommended.summary}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <article className="whitespace-pre-wrap rounded-md bg-zinc-50 p-4 text-[15px] leading-8">
            {recommended.excerpt}
          </article>
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-4">
          {isCurrentRound ? (
            <div className="rounded-md border bg-[#fbfaf6] p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-medium text-muted-foreground">
                  反馈方向
                </span>
              </div>
              <ToggleGroup
                type="single"
                value={feedbackDirection ?? ""}
                onValueChange={(value) => {
                  onFeedbackDirectionChange(value ? (value as FeedbackDirection) : null);
                }}
                className="flex flex-wrap justify-start gap-2"
                variant="outline"
                size="sm"
              >
                {Object.entries(FEEDBACK_DIRECTIONS).map(([value, direction]) => (
                  <ToggleGroupItem
                    key={value}
                    value={value}
                    className="rounded-full border-zinc-200 bg-white text-zinc-700 shadow-sm transition hover:border-zinc-400 hover:bg-white data-[state=on]:border-zinc-600 data-[state=on]:bg-zinc-100 data-[state=on]:text-zinc-950 data-[state=on]:shadow-sm data-[state=on]:ring-1 data-[state=on]:ring-zinc-300"
                  >
                    {feedbackDirection === value ? (
                      <Check data-icon="inline-start" className="size-3.5" />
                    ) : null}
                    {direction.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <Textarea
                value={supplementContext}
                onChange={(event) => onSupplementContextChange(event.target.value)}
                placeholder="补充一句要求（可选）：例如更具体一点，少用抽象比喻。"
                className="mt-3 min-h-20 resize-none"
              />
              {showFeedbackHint ? (
                <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  缺少反馈信号。
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-md border bg-[#fbfaf6] p-3 text-sm text-muted-foreground">
              这是历史结果。可以复制或标为最终。
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onFinalize(recommended)}
              disabled={busy || isFinalizedCandidate}
              className="text-muted-foreground"
            >
              <Check data-icon="inline-start" />
              {isFinalizedCandidate ? "已标最终" : "标为最终"}
            </Button>
            {isCurrentRound && !topicFinalized ? (
              <Button variant="outline" onClick={onRefine} disabled={busy}>
                {busy ? (
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                ) : (
                  <RefreshCw data-icon="inline-start" />
                )}
                再来一轮
              </Button>
            ) : null}
            <Button onClick={() => onCopyCandidate(recommended)} disabled={busy}>
              {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
              {copied ? "已复制" : "复制文本"}
            </Button>
          </div>
        </CardFooter>
      </Card>

      {alternatives.length ? (
        <Card>
          <CardHeader>
            <CardTitle>其余版本</CardTitle>
            <CardDescription>
              默认折叠，需要时展开对比。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {alternatives.map((candidate) => {
              const expanded = expandedCandidateId === candidate.id;
              const finalizedAlternative = topic.run.finalizedCandidateId === candidate.id;
              const score = candidateScore(topic.run, candidate);
              const signal = candidateSignal(topic.run, candidate);
              const tone = candidateTone(topic.run, candidate);
              return (
                <div key={candidate.id} className="rounded-md border">
                  <button
                    type="button"
                    className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left"
                    onClick={() => onToggleCandidate(expanded ? null : candidate.id)}
                  >
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="truncate text-sm font-medium">{candidate.title}</div>
                        {finalizedAlternative ? (
                          <Check className="size-3.5 shrink-0 text-emerald-600" />
                        ) : null}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>{candidate.version}</span>
                        {score !== null ? <span>Eval {score}</span> : null}
                        <span>强项：{tone}</span>
                        <span className="line-clamp-1 max-w-[360px]">{signal}</span>
                      </div>
                    </div>
                    <Badge variant={finalizedAlternative ? "secondary" : "outline"}>
                      {finalizedAlternative ? "最终" : score !== null ? `Eval ${score}` : tone}
                    </Badge>
                  </button>
                  {expanded ? (
                    <>
                      <Separator />
                      <div className="whitespace-pre-wrap px-4 py-3 text-sm leading-7 text-zinc-700">
                        {candidate.excerpt}
                      </div>
                    </>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function RuntimeProgress({
  action,
  lines,
}: {
  action: Exclude<RuntimeAction, null>;
  lines: string[];
}) {
  const title = action === "generate" ? "正在生成结果" : "正在再来一轮";
  const description =
    action === "generate"
      ? "系统正在理解主题、写出 3 个版本，并整理可比较结果。"
      : "系统正在吸收你的反馈，重新写出 3 个可比较版本。";
  const visibleLines = lines.slice(-4);
  const latestLineIndex = visibleLines.length - 1;

  return (
    <Card className="border-zinc-200 bg-[#fbfaf6]">
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border bg-white">
            <Loader2 className="size-4 animate-spin text-zinc-700" />
          </span>
          <div className="min-w-0">
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="min-w-0 rounded-md border bg-white px-3 py-2 text-sm">
          <div className="flex flex-col gap-1.5">
            {visibleLines.map((line, index) => (
              <div
                key={`${line}-${index}`}
                className={cn(
                  "flex gap-2 leading-6",
                  index === latestLineIndex ? "font-medium text-zinc-950" : "text-zinc-500",
                )}
              >
                <span
                  className={cn(
                    "mt-2 size-1.5 shrink-0 rounded-full",
                    index === latestLineIndex ? "bg-zinc-900" : "bg-zinc-300",
                  )}
                />
                <span className="min-w-0 break-words">{line}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TopicContextDisclosure({ topic }: { topic: WritingTopicView }) {
  const [copiedField, setCopiedField] = useState<"original" | "boundary" | null>(null);

  async function copyContextText(kind: "original" | "boundary", text: string) {
    const ok = await copyTextSafely(text);
    if (ok) {
      setCopiedField(kind);
      window.setTimeout(() => setCopiedField(null), 1400);
    }
  }

  const originalInput = topic.run.quickIntake || topic.run.jobSpec.source || "未记录原始输入";
  const systemBoundary =
    topic.run.precheckRun.contentBrief || topic.run.jobSpec.goal || "尚未形成系统理解";

  return (
    <details className="group rounded-lg border bg-[#fbfaf6] px-4 py-3 text-sm [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="line-clamp-1 font-medium">{topic.title}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            回看原始输入和系统理解
          </div>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
      </summary>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <section className="min-w-0 rounded-md border bg-white p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-xs font-medium text-muted-foreground">原始输入</div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => copyContextText("original", originalInput)}
            >
              <Copy data-icon="inline-start" />
              {copiedField === "original" ? "已复制" : "复制"}
            </Button>
          </div>
          <div className="max-h-32 select-text overflow-auto whitespace-pre-wrap break-words text-xs leading-6 text-zinc-700">
            {originalInput}
          </div>
        </section>
        <section className="min-w-0 rounded-md border bg-white p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-xs font-medium text-muted-foreground">系统理解</div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => copyContextText("boundary", systemBoundary)}
            >
              <Copy data-icon="inline-start" />
              {copiedField === "boundary" ? "已复制" : "复制"}
            </Button>
          </div>
          <div className="max-h-32 select-text overflow-auto whitespace-pre-wrap break-words text-xs leading-6 text-zinc-700">
            {systemBoundary}
          </div>
        </section>
      </div>
    </details>
  );
}
