import { createHash, randomUUID } from "node:crypto";

import { getLLMProvider } from "@/lib/llm/provider";
import type { CandidateDraft, LLMProviderResponse, CandidateGenerationDraft, PrecheckDraft } from "@/lib/llm/types";
import { jsonRunStore } from "@/lib/run-store";
import { bindTraceToRun } from "@/lib/trace-sink";
import {
  buildWritingCandidateEvalRun,
  writeWritingCandidateEvalScores,
  writeWritingHumanFeedbackScore,
} from "@/lib/writing-eval-adapter";
import {
  candidateFrameworkRun,
  captureRuntimeLLMTrace,
  feedbackFrameworkRun,
  normalizeFrameworkTraceBindings,
  precheckFrameworkRun,
  rulePatchFrameworkRun,
  scopeFrameworkRun,
} from "@/lib/writing-framework-trace";
import {
  RULE_PATCH_DRAFT_LIMIT,
  RULE_SNAPSHOT_RULE_LIMIT,
} from "@/lib/writing-run-types";
import type {
  CandidateRecord,
  CompileRulePatchInput,
  CreateWritingRunInput,
  FinalizeWritingRunInput,
  GenerationRunRecord,
  HumanFeedbackInput,
  HumanFeedbackRecord,
  PrecheckRun,
  RuleScopeExtractionEval,
  RulePatchRecord,
  RuleSnapshotRecord,
  RunGenerationBatchInput,
  TextOutputContract,
  TraceStep,
  DeriveWritingRuleScopeInput,
  SkillPackageSnapshot,
  WritingRuleScopeRecord,
  OutputProfileSnapshot,
  WritingRulesCandidateRecord,
  WritingRunRecord,
} from "@/lib/writing-run-types";
import type { LLMCallTraceRecord } from "@/lib/framework-run-types";

const BASELINE_OUTPUT_CONTRACT: TextOutputContract = {
  artifactType: "short explanatory text",
  lengthRange: "300-500 中文字（约 60-90 秒口播基准）",
  structure: "标题 + 判断开场 + 2-3 个短论证段 + 下一步",
  formatRules: "Markdown 正文；除非任务明确要求，不生成表格。",
  groundingRules: "每个关键判断必须能回指到底稿、用户输入或标注为待确认。",
  specialHandling: "不编造事实；不复制参考文句式；不确定内容标注低置信；复杂公式只标记为下游专项处理。",
  downstreamHandoff: "输出短文本产物；TTS 目标 60-90 秒；视频在下游节点独立处理。",
};

function outputContractFor(inputOrRun: { outputContract?: TextOutputContract }) {
  return inputOrRun.outputContract ?? BASELINE_OUTPUT_CONTRACT;
}

function now() {
  return new Date().toISOString();
}

function shortId(prefix: string) {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

function scoreSeed(seed: string, min: number, spread: number) {
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 8);
  return min + (Number.parseInt(hex, 16) % spread);
}

function clampScore(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function storePathFor(runId: string) {
  return jsonRunStore.pathFor(runId);
}

function rulesCandidateVersion(run: WritingRunRecord) {
  return run.rulesCandidate.version ?? `${run.skillPackage.version}-candidate-r${run.round ?? 1}`;
}

function normalizedRulePatches(run: WritingRunRecord) {
  return run.rulePatches ?? [];
}

function normalizedRuleSnapshots(run: WritingRunRecord): RuleSnapshotRecord[] {
  if (run.ruleSnapshots?.length) {
    return run.ruleSnapshots;
  }

  return [
    {
      id: `rule_snapshot_${run.id}_r1`,
      at: run.createdAt,
      version: "rules-v1",
      status: "active",
      rules: run.precheckRun.writingRulesCandidate,
      sourcePatchIds: [],
    },
  ];
}

function normalizedGenerationRuns(run: WritingRunRecord): GenerationRunRecord[] {
  if (run.generationRuns?.length) {
    return run.generationRuns;
  }

  if (!run.candidates.length || !run.evalRun) {
    return [];
  }

  return [
    {
      id: `generation_${run.id}_r${run.round ?? 1}`,
      at: run.updatedAt,
      round: run.round ?? 1,
      status: "complete",
      ruleSnapshotId: normalizedRuleSnapshots(run).at(-1)?.id ?? `rule_snapshot_${run.id}_r1`,
      candidateIds: run.candidates.map((candidate) => candidate.id),
      evalRunId: run.evalRun.id,
    },
  ];
}

type LegacyWritingRunRecord = WritingRunRecord & {
  skill?: SkillPackageSnapshot;
  skillCandidate?: Partial<WritingRulesCandidateRecord>;
};

function normalizePrecheckRun(run: LegacyWritingRunRecord): PrecheckRun {
  const raw = (run.precheckRun ?? {}) as Partial<PrecheckRun> & {
    writingRuleCandidate?: string[];
  };

  return {
    id: raw.id ?? `precheck_${run.id}`,
    status: raw.status === "confirmed" ? "confirmed" : "ready",
    warning: raw.warning,
    contentBrief: raw.contentBrief ?? "",
    groundingBrief: raw.groundingBrief ?? "",
    writingRulesCandidate: Array.isArray(raw.writingRulesCandidate)
      ? raw.writingRulesCandidate
      : Array.isArray(raw.writingRuleCandidate)
        ? raw.writingRuleCandidate
        : [],
    riskChecks: Array.isArray(raw.riskChecks) ? raw.riskChecks : [],
  };
}

function normalizeRuleScope(run: LegacyWritingRunRecord): WritingRuleScopeRecord | null {
  if (!run.ruleScope) {
    return null;
  }

  const scope = run.ruleScope as Partial<WritingRuleScopeRecord>;
  return {
    ...scope,
    id: scope.id ?? `rule_scope_${run.id}`,
    createdAt: scope.createdAt ?? run.createdAt,
    status: scope.status ?? "confirmed",
    source: scope.source ?? "baseline",
    quickIntakeDigest: scope.quickIntakeDigest ?? digest(run.quickIntake ?? run.jobSpec?.goal ?? ""),
    items: Array.isArray(scope.items) ? scope.items : [],
    eval: {
      id: scope.eval?.id ?? `scope_eval_${run.id}`,
      status: "complete",
      score: scope.eval?.score ?? 0,
      checks: Array.isArray(scope.eval?.checks) ? scope.eval.checks : [],
    },
    llmTrace:
      scope.llmTrace ??
      ({
        id: `llm_trace_${run.id}_scope_legacy`,
        at: run.createdAt,
        status: "complete",
        sink: "local-json",
        provider: "legacy",
        model: "legacy",
        promptVersion: "legacy",
        runId: run.id,
        nodeType: "rule_scope_extraction",
        inputRefs: ["legacy_run"],
        outputArtifact: {
          id: `rule_scope_${run.id}`,
          kind: "rule_scope",
          label: "Rule Scope",
          summary: "legacy normalized rule scope",
          ref: run.id,
        },
      } satisfies LLMCallTraceRecord),
    warning: scope.warning ?? "",
  };
}

function normalizeJobSpec(run: LegacyWritingRunRecord) {
  const spec = run.jobSpec ?? {};
  return {
    title: spec.title ?? "未命名任务",
    goal: spec.goal ?? run.quickIntake ?? "",
    source: spec.source ?? "",
    writingReference: spec.writingReference ?? "",
    reviewPreference: spec.reviewPreference ?? "",
  };
}

function normalizeWritingRunRecord(run: WritingRunRecord): WritingRunRecord {
  const legacyRun = run as LegacyWritingRunRecord;
  const precheckRun = normalizePrecheckRun(legacyRun);
  const skillPackage: SkillPackageSnapshot =
    legacyRun.skillPackage ??
    legacyRun.skill ?? {
      id: "baseline",
      category: "未分类",
      version: "baseline-v1",
      status: "candidate",
    };
  const outputProfile: OutputProfileSnapshot = legacyRun.outputProfile ?? {
    name: "Baseline Text Output",
    artifacts: ["short_text"],
  };
  const rulesCandidate: WritingRulesCandidateRecord = {
    id: legacyRun.rulesCandidate?.id ?? legacyRun.skillCandidate?.id ?? `rules_candidate_${skillPackage.id}`,
    status: "candidate",
    version:
      legacyRun.rulesCandidate?.version ??
      legacyRun.skillCandidate?.version ??
      `${skillPackage.version}-candidate-r${legacyRun.round ?? 1}`,
    iterationCount: legacyRun.rulesCandidate?.iterationCount ?? legacyRun.skillCandidate?.iterationCount ?? 0,
    meanHumanScore: legacyRun.rulesCandidate?.meanHumanScore ?? legacyRun.skillCandidate?.meanHumanScore ?? null,
    updateNote:
      legacyRun.rulesCandidate?.updateNote ??
      legacyRun.skillCandidate?.updateNote ??
      "等待候选评分和人工反馈。",
  };

  const base: WritingRunRecord = {
    ...legacyRun,
    status: legacyRun.status ?? "precheck_ready",
    round: legacyRun.round ?? 1,
    storePath: legacyRun.storePath ?? storePathFor(legacyRun.id),
    quickIntake: legacyRun.quickIntake ?? "",
    ruleScope: normalizeRuleScope(legacyRun),
    skillPackage,
    outputProfile,
    outputContract: outputContractFor(legacyRun),
    jobSpec: normalizeJobSpec(legacyRun),
    precheckRun,
    candidates: Array.isArray(legacyRun.candidates) ? legacyRun.candidates : [],
    evalRun: legacyRun.evalRun ?? null,
    feedback: Array.isArray(legacyRun.feedback) ? legacyRun.feedback : [],
    rulePatches: Array.isArray(legacyRun.rulePatches) ? legacyRun.rulePatches : [],
    ruleSnapshots: [],
    generationRuns: [],
    rulesCandidate,
    frameworkRuns: Array.isArray(legacyRun.frameworkRuns) ? legacyRun.frameworkRuns : [],
    llmTraces: Array.isArray(legacyRun.llmTraces) ? legacyRun.llmTraces : [],
    trace: Array.isArray(legacyRun.trace) ? legacyRun.trace : [],
  };

  base.ruleSnapshots = Array.isArray(legacyRun.ruleSnapshots) && legacyRun.ruleSnapshots.length
    ? legacyRun.ruleSnapshots.map((snapshot) => ({
        ...snapshot,
        rules: Array.isArray(snapshot.rules) ? snapshot.rules : [],
        sourcePatchIds: Array.isArray(snapshot.sourcePatchIds) ? snapshot.sourcePatchIds : [],
      }))
    : normalizedRuleSnapshots(base);
  base.generationRuns = Array.isArray(legacyRun.generationRuns) && legacyRun.generationRuns.length
    ? legacyRun.generationRuns.map((generationRun) => ({
        ...generationRun,
        candidateIds: Array.isArray(generationRun.candidateIds) ? generationRun.candidateIds : [],
      }))
    : normalizedGenerationRuns(base);

  return normalizeFrameworkTraceBindings(base);
}

async function persistRun(run: WritingRunRecord) {
  await jsonRunStore.put(normalizeFrameworkTraceBindings(run));
}

function trace(event: string, input: string, output: string, layer: TraceStep["layer"] = "L1"): TraceStep {
  return {
    id: shortId("trace"),
    at: now(),
    layer,
    event,
    input,
    output,
  };
}

function digest(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "empty";
  }

  return normalized.length > 80 ? `${normalized.slice(0, 80)}...` : normalized;
}

function scopeKindLabel(kind: WritingRuleScopeRecord["items"][number]["kind"]) {
  switch (kind) {
    case "structure":
      return "结构";
    case "tone":
      return "语气";
    case "prohibition":
      return "禁忌";
    case "checklist":
      return "检查点";
    default:
      return "规则";
  }
}

export async function deriveWritingRuleScope(input: DeriveWritingRuleScopeInput): Promise<WritingRuleScopeRecord> {
  const provider = getLLMProvider();
  const referencePaste = input.referencePaste?.trim() ?? "";
  const response = await provider.generateRuleScope({
    quickIntake: input.quickIntake,
    referencePaste,
  });
  const createdAt = now();
  const evalRecord: RuleScopeExtractionEval = {
    id: shortId("scope_eval"),
    ...response.output.eval,
  };
  const scopeId = shortId("rule_scope");
  const llmTrace = await captureRuntimeLLMTrace({
    provider: response.provider,
    model: response.model,
    promptVersion: response.promptVersion,
    nodeType: "scope_extraction",
    inputRefs: ["quick_intake", referencePaste ? "reference_paste" : "baseline_scope"],
    outputArtifact: {
      id: scopeId,
      kind: "writing_rule_scope",
      label: "写作规则范围",
      summary: `${response.output.items.length} 条 scope 项；${response.output.source}`,
    },
    evalResult: {
      id: evalRecord.id,
      kind: "scope_extraction_eval",
      status: "complete",
      score: evalRecord.score,
    },
    runId: input.runId,
    upstreamTraceId: response.traceId,
    latencyMs: response.latencyMs,
    llmResponse: response,
    metadata: {
      referenceProvided: Boolean(referencePaste),
      scopeItemCount: response.output.items.length,
    },
  });

  return {
    id: scopeId,
    createdAt,
    status: "draft",
    source: response.output.source,
    quickIntakeDigest: digest(input.quickIntake),
    referencePaste: referencePaste || undefined,
    items: response.output.items.map((item) => ({
      id: shortId("scope_item"),
      ...item,
    })),
    eval: evalRecord,
    llmTrace,
    warning: response.output.warning,
  };
}

function precheckRunFromDraft(runId: string, draft: PrecheckDraft): PrecheckRun {
  return {
    id: `precheck_${runId}`,
    status: "ready",
    warning: draft.warning,
    contentBrief: draft.contentBrief,
    groundingBrief: draft.groundingBrief,
    writingRulesCandidate: draft.writingRulesCandidate,
    riskChecks: draft.riskChecks,
  };
}

function initialRuleSnapshot(runId: string, createdAt: string, precheckRun: PrecheckRun): RuleSnapshotRecord {
  return {
    id: `rule_snapshot_${runId}_r1`,
    at: createdAt,
    version: "rules-v1",
    status: "active",
    rules: precheckRun.writingRulesCandidate,
    sourcePatchIds: [],
  };
}

function feedbackRule(feedback: HumanFeedbackRecord) {
  switch (feedback.businessReason) {
    case "任务不准":
      return "反馈规则：下一轮开头必须复述任务边界和目标受众，避免泛化成普通 AI 观点文。";
    case "事实不稳":
      return "反馈规则：下一轮只使用底稿中明确出现的信息，缺证据处必须标记为待确认。";
    case "风格不对":
      return "反馈规则：下一轮降低营销腔和口号化表达，优先使用判断、证据、下一步结构。";
    case "偏好不符":
      return "反馈规则：下一轮按本轮偏好重排论证重点，不把单次偏好直接发布为长期规则。";
    case "风险过高":
      return "反馈规则：下一轮减少相似表达和未经验证的确定性结论。";
    case "表达冗余":
      return "反馈规则：下一轮压缩铺垫，每段只保留一个判断和一个证据。";
    case "结构问题":
      return "反馈规则：下一轮先给结论，再按问题、证据、决策建议展开。";
    case "正向样本":
      return "反馈规则：下一轮复用被喜欢片段的论证动作，但不复制原句。";
    default:
      return "反馈规则：下一轮优先处理已标注的局部问题，并保留可追溯依据。";
  }
}

function feedbackSummary(
  run: WritingRunRecord,
  preferredCandidateId?: string,
  feedbackIds?: string[],
) {
  const feedback = run.feedback.filter((item) => {
    if (feedbackIds?.length) {
      return feedbackIds.includes(item.id);
    }

    return preferredCandidateId ? item.candidateId === preferredCandidateId : true;
  });
  const selectionFeedback = feedback.filter((item) => item.kind === "selection");
  const source = selectionFeedback.length > 0 ? selectionFeedback : feedback;
  const rules = Array.from(new Set(source.map(feedbackRule))).slice(0, 4);
  const reasons = Array.from(
    new Set(source.map((item) => item.businessReason ?? (item.score ? "人工评分" : "局部反馈"))),
  );
  const hasPositive = source.some((item) => item.businessReason === "正向样本" || item.verdict === "liked");
  const hasTaskIssue = source.some((item) => item.businessReason === "任务不准");
  const hasFactIssue = source.some((item) => item.businessReason === "事实不稳" || item.businessReason === "风险过高");
  const hasStyleIssue = source.some((item) =>
    ["风格不对", "偏好不符", "表达冗余", "结构问题"].includes(item.businessReason ?? ""),
  );
  const signature = source
    .map((item) => `${item.candidateId}:${item.businessReason ?? item.score ?? item.kind}`)
    .join("|");

  return {
    count: source.length,
    rules,
    reasons,
    hasPositive,
    hasTaskIssue,
    hasFactIssue,
    hasStyleIssue,
    signature: signature || "no-feedback",
    updateNote:
      source.length > 0
        ? `第 ${(run.round ?? 1) + 1} 轮采纳 ${source.length} 条反馈：${reasons.join(" / ")}。`
        : `第 ${(run.round ?? 1) + 1} 轮未发现新增反馈，记录 no-change rationale。`,
  };
}

function compactRuleText(...rules: string[]) {
  const fragments = Array.from(
    new Set(
      rules
        .flatMap((rule) =>
          rule
            .replace(/^反馈规则：/, "")
            .split(/[；;]/)
            .map((fragment) => fragment.replace(/[。.]$/, "").trim()),
        )
        .filter(Boolean),
    ),
  ).slice(0, 3);

  return `反馈规则：${fragments.join("；")}。`;
}

function mergeReasons(...reasons: string[]) {
  return Array.from(
    new Set(
      reasons
        .flatMap((reason) => reason.split(" / "))
        .map((reason) => reason.trim())
        .filter(Boolean),
    ),
  )
    .slice(0, 4)
    .join(" / ");
}

function capRuleSnapshotRules(rules: string[]) {
  const uniqueRules = Array.from(new Set(rules));
  if (uniqueRules.length <= RULE_SNAPSHOT_RULE_LIMIT) {
    return uniqueRules;
  }

  const foundationCount = Math.min(5, RULE_SNAPSHOT_RULE_LIMIT);
  const foundationRules = uniqueRules.slice(0, foundationCount);
  const latestRules = uniqueRules.slice(foundationCount).slice(-(RULE_SNAPSHOT_RULE_LIMIT - foundationCount));
  return [...foundationRules, ...latestRules];
}

function scoreFromDraft(
  draft: CandidateDraft,
  seed: string,
  index: number,
  round: number,
): CandidateRecord["breakdown"] {
  const raw = draft.breakdown ?? {};
  const quality = clampScore(raw.quality ?? scoreSeed(`${seed}:quality:${index}`, 24, 6) + (round > 1 ? 1 : 0), 0, 35);
  const fit = clampScore(raw.fit ?? scoreSeed(`${seed}:fit:${index}`, 27, 7), 0, 35);
  const style = clampScore(raw.style ?? scoreSeed(`${seed}:style:${index}`, 20, 7), 0, 30);
  const risk = -clampScore(Math.abs(raw.risk ?? scoreSeed(`${seed}:risk:${index}`, 3, 6)), 0, 10);

  return { quality, fit, style, risk };
}

function candidateRecordFromDraft(
  run: WritingRunRecord,
  ruleSnapshot: RuleSnapshotRecord,
  draft: CandidateDraft,
  index: number,
): CandidateRecord {
  const round = run.round ?? 1;
  const seed = `${run.id}:${ruleSnapshot.id}:${draft.title}:${draft.excerpt.slice(0, 120)}`;
  const breakdown = scoreFromDraft(draft, seed, index, round);

  return {
    id: `candidate_r${round}_${index + 1}`,
    round,
    runId: `generation_${run.id}_r${round}`,
    generatedByRuleSnapshotId: ruleSnapshot.id,
    version: `第 ${round} 批 · 版本 ${index + 1}`,
    title: draft.title,
    summary: draft.summary,
    excerpt: draft.excerpt,
    total: breakdown.quality + breakdown.fit + breakdown.style + breakdown.risk,
    humanScore: "pending",
    breakdown,
    rationale: draft.rationale,
    risk: draft.risk,
    feedbackApplied: normalizedRulePatches(run)
      .filter((patch) => ruleSnapshot.sourcePatchIds.includes(patch.id))
      .map((patch) => patch.rule),
  };
}

async function generateCandidates(
  run: WritingRunRecord,
  ruleSnapshot: RuleSnapshotRecord,
  candidateCount = 3,
): Promise<{
  candidates: CandidateRecord[];
  response: LLMProviderResponse<CandidateGenerationDraft>;
}> {
  const response = await getLLMProvider().generateCandidates({
    round: run.round ?? 1,
    candidateCount,
    jobSpec: run.jobSpec,
    outputContract: outputContractFor(run),
    outputProfile: run.outputProfile,
    skillPackage: run.skillPackage,
    precheckRun: run.precheckRun,
    ruleScope: run.ruleScope,
    ruleSnapshot,
    feedback: run.feedback,
    rulePatches: normalizedRulePatches(run),
  });

  return {
    response,
    candidates: response.output.candidates
      .slice(0, candidateCount)
      .map((draft, index) => candidateRecordFromDraft(run, ruleSnapshot, draft, index)),
  };
}

function buildEvalRun(run: WritingRunRecord, candidates: CandidateRecord[]) {
  const round = run.round ?? 1;
  return buildWritingCandidateEvalRun({
    runId: run.id,
    round,
    outputContract: outputContractFor(run),
    jobSpec: run.jobSpec,
    precheckRun: run.precheckRun,
    candidates,
  });
}

async function attachCandidateEvalScores(input: {
  runId: string;
  round: number;
  trace: LLMCallTraceRecord;
  evalRun: ReturnType<typeof buildEvalRun>;
}) {
  const result = await writeWritingCandidateEvalScores({
    runId: input.runId,
    nodeRunId: input.trace.nodeRunId,
    trace: input.trace,
    evalRun: input.evalRun,
    round: input.round,
  });

  return {
    ...input.trace,
    metadata: {
      ...(input.trace.metadata ?? {}),
      scoreSink: result.sink,
      scoreSinkStatus: result.status,
      scoreCount: result.scoreCount,
      scoreSinkError: result.error ?? null,
    },
  };
}

async function attachHumanFeedbackScore(input: {
  runId: string;
  trace: LLMCallTraceRecord;
  feedback: HumanFeedbackRecord;
}) {
  const result = await writeWritingHumanFeedbackScore({
    runId: input.runId,
    nodeRunId: input.trace.nodeRunId,
    trace: input.trace,
    feedback: input.feedback,
  });

  return {
    ...input.trace,
    metadata: {
      ...(input.trace.metadata ?? {}),
      feedbackScoreSink: result.sink,
      feedbackScoreSinkStatus: result.status,
      feedbackScoreCount: result.scoreCount,
      feedbackScoreSinkError: result.error ?? null,
    },
  };
}

export async function createWritingRun(input: CreateWritingRunInput) {
  const id = shortId("run");
  const createdAt = now();
  const derivedScope =
    input.ruleScope ??
    (await deriveWritingRuleScope({
      quickIntake: input.quickIntake,
      referencePaste: input.referencePaste,
      runId: id,
    }));
  const confirmedScope: WritingRuleScopeRecord = {
    ...derivedScope,
    status: "confirmed",
    llmTrace: bindTraceToRun(derivedScope.llmTrace, id),
  };
  const normalizedInput: CreateWritingRunInput = {
    ...input,
    referencePaste: input.referencePaste ?? confirmedScope.referencePaste,
    ruleScope: confirmedScope,
  };
  const precheckResponse = await getLLMProvider().generatePrecheck({
    quickIntake: normalizedInput.quickIntake,
    referencePaste: normalizedInput.referencePaste,
    jobSpec: normalizedInput.jobSpec,
    outputContract: outputContractFor(normalizedInput),
    outputProfile: normalizedInput.outputProfile,
    skillPackage: normalizedInput.skillPackage,
    ruleScope: confirmedScope,
  });
  const precheckRun = precheckRunFromDraft(id, precheckResponse.output);
  const precheckTrace = await captureRuntimeLLMTrace({
    provider: precheckResponse.provider,
    model: precheckResponse.model,
    promptVersion: precheckResponse.promptVersion,
    nodeType: "precheck_normalization",
    runId: id,
    inputRefs: ["job_spec", "output_contract", confirmedScope.id],
    outputArtifact: {
      id: precheckRun.id,
      kind: "precheck_candidate",
      label: "生成前检查候选",
      summary: `${precheckRun.writingRulesCandidate.length} 条规则；${precheckRun.riskChecks.length} 条风险检查`,
      ref: id,
    },
    upstreamTraceId: precheckResponse.traceId,
    latencyMs: precheckResponse.latencyMs,
    llmResponse: precheckResponse,
    metadata: {
      riskCheckCount: precheckRun.riskChecks.length,
      writingRuleCount: precheckRun.writingRulesCandidate.length,
      fallback: precheckResponse.provider.includes("fallback"),
    },
  });
  const ruleSnapshot = initialRuleSnapshot(id, createdAt, precheckRun);
  const run: WritingRunRecord = {
    id,
    createdAt,
    updatedAt: createdAt,
    status: "precheck_ready",
    round: 1,
    storePath: storePathFor(id),
    quickIntake: input.quickIntake,
    referencePaste: normalizedInput.referencePaste,
    ruleScope: confirmedScope,
    skillPackage: input.skillPackage,
    outputProfile: input.outputProfile,
    outputContract: outputContractFor(input),
    jobSpec: input.jobSpec,
    precheckRun,
    candidates: [],
    evalRun: null,
    feedback: [],
    rulePatches: [],
    ruleSnapshots: [ruleSnapshot],
    generationRuns: [],
    rulesCandidate: {
      id: `rules_candidate_${input.skillPackage.id}`,
      status: "candidate",
      version: `${input.skillPackage.version}-candidate-r1`,
      iterationCount: 0,
      meanHumanScore: null,
      updateNote: "等待候选评分和人工反馈。",
    },
    frameworkRuns: [
      scopeFrameworkRun(confirmedScope),
      precheckFrameworkRun(id, precheckRun, confirmedScope, precheckTrace),
    ],
    llmTraces: [confirmedScope.llmTrace, precheckTrace],
    trace: [
      trace("job.created", input.quickIntake || input.jobSpec.title, "输入契约草稿已写入任务存储"),
      trace("rule_scope.confirmed", confirmedScope.id, `${confirmedScope.items.length} 条写作规则范围已确认`),
      trace("output_contract.bound", outputContractFor(input).artifactType, "输出契约已绑定为本轮交付契约"),
      trace("precheck.ready", input.jobSpec.source, "生成前检查候选已生成"),
    ],
  };

  await persistRun(run);
  return run;
}

export async function readWritingRun(runId: string) {
  return normalizeWritingRunRecord(await jsonRunStore.get(runId));
}

export async function listWritingRuns() {
  return (await jsonRunStore.list()).map(normalizeWritingRunRecord);
}

export async function confirmWritingRunPrecheck(runId: string) {
  const run = await readWritingRun(runId);
  const normalizedRun = { ...run, round: run.round ?? 1 };
  const ruleSnapshots = normalizedRuleSnapshots(normalizedRun);
  const activeRuleSnapshot = ruleSnapshots.at(-1) ?? initialRuleSnapshot(run.id, run.createdAt, run.precheckRun);
  const candidateGeneration = await generateCandidates(normalizedRun, activeRuleSnapshot);
  const { candidates } = candidateGeneration;
  const evalRun = buildEvalRun(normalizedRun, candidates);
  const candidateTrace = await attachCandidateEvalScores({
    runId: run.id,
    round: normalizedRun.round,
    evalRun,
    trace: await captureRuntimeLLMTrace({
      provider: candidateGeneration.response.provider,
      model: candidateGeneration.response.model,
      promptVersion: candidateGeneration.response.promptVersion,
      nodeType: "candidate_generation",
      runId: run.id,
      inputRefs: ["precheck_candidate", activeRuleSnapshot.id],
      outputArtifact: {
        id: `candidate_artifacts_${run.id}_r${normalizedRun.round}`,
        kind: "candidate_batch",
        label: "候选批次",
        summary: `${candidates.length} 个候选版本；第 ${normalizedRun.round} 批`,
        ref: run.id,
      },
      evalResult: {
        id: evalRun.id,
        kind: "candidate_auto_eval",
        status: "complete",
        score: null,
      },
      upstreamTraceId: candidateGeneration.response.traceId,
      latencyMs: candidateGeneration.response.latencyMs,
      llmResponse: candidateGeneration.response,
      metadata: {
        candidateCount: candidates.length,
        round: normalizedRun.round,
        warning: candidateGeneration.response.output.warning,
        fallback: candidateGeneration.response.provider.includes("fallback"),
      },
    }),
  });
  const generationRun: GenerationRunRecord = {
    id: `generation_${run.id}_r${normalizedRun.round}`,
    at: now(),
    round: normalizedRun.round,
    status: "complete",
    ruleSnapshotId: activeRuleSnapshot.id,
    candidateIds: candidates.map((candidate) => candidate.id),
    evalRunId: evalRun.id,
  };
  const updated: WritingRunRecord = {
    ...run,
    updatedAt: now(),
    status: "candidate_ready",
    round: normalizedRun.round,
    precheckRun: { ...run.precheckRun, status: "confirmed" },
    candidates,
    evalRun,
    rulePatches: normalizedRulePatches(run),
    ruleSnapshots,
    generationRuns: [...normalizedGenerationRuns(run), generationRun],
    rulesCandidate: {
      ...run.rulesCandidate,
      version: rulesCandidateVersion(normalizedRun),
    },
    frameworkRuns: [
      ...(run.frameworkRuns ?? []),
      candidateFrameworkRun(normalizedRun, evalRun, candidates.map((candidate) => candidate.id), candidateTrace),
    ],
    llmTraces: [...(run.llmTraces ?? []), candidateTrace],
    trace: [
      ...run.trace,
      trace("precheck.confirmed", run.precheckRun.id, "生成前检查候选被确认为本轮生成契约"),
      trace("candidate.generated", candidates.map((candidate) => candidate.id).join(", "), "候选版本已生成"),
      trace("eval.completed", evalRun.id, "评分运行已完成归因", "L2"),
    ],
  };

  await persistRun(updated);
  return updated;
}

export async function compileRulePatch(runId: string, input: CompileRulePatchInput) {
  const run = await readWritingRun(runId);
  const patches = normalizedRulePatches(run);
  const feedback = run.feedback.filter(
    (item) =>
      item.candidateId === input.candidateId &&
      item.status !== "compiled" &&
      item.status !== "dismissed",
  );
  if (!feedback.length) {
    const updated: WritingRunRecord = {
      ...run,
      updatedAt: now(),
      rulePatches: patches,
      ruleSnapshots: normalizedRuleSnapshots(run),
      generationRuns: normalizedGenerationRuns(run),
      trace: [
        ...run.trace,
        trace("rule_patch.skipped", input.candidateId, "没有未处理反馈，未生成空规则草稿", "L2"),
      ],
    };

    await persistRun(updated);
    return updated;
  }

  const draftPatchIndexes = patches
    .map((patch, index) => ({ patch, index }))
    .filter(({ patch }) => patch.status === "draft");
  const candidate = run.candidates.find((item) => item.id === input.candidateId);
  const patchResponse = await getLLMProvider().compileRulePatch({
    jobSpec: run.jobSpec,
    precheckRun: run.precheckRun,
    candidate,
    feedback,
    existingDraftRules: draftPatchIndexes.map(({ patch }) => patch),
  });
  const patchDraft: RulePatchRecord = {
    id: shortId("rule_patch"),
    at: now(),
    status: "draft",
    sourceCandidateId: input.candidateId,
    feedbackIds: feedback.map((item) => item.id),
    reason: patchResponse.output.reason,
    rule: patchResponse.output.rule,
    note: patchResponse.output.note,
  };
  const sameRuleTarget = draftPatchIndexes.find(({ patch }) => patch.rule === patchDraft.rule);
  const capMergeTarget =
    sameRuleTarget ?? (draftPatchIndexes.length >= RULE_PATCH_DRAFT_LIMIT ? draftPatchIndexes.at(-1) : undefined);
  const patch =
    capMergeTarget
      ? {
          ...capMergeTarget.patch,
          at: now(),
          sourceCandidateId:
            capMergeTarget.patch.sourceCandidateId === input.candidateId
              ? capMergeTarget.patch.sourceCandidateId
              : "merged",
          feedbackIds: Array.from(new Set([...capMergeTarget.patch.feedbackIds, ...patchDraft.feedbackIds])),
          reason: mergeReasons(capMergeTarget.patch.reason, patchDraft.reason),
          rule: compactRuleText(capMergeTarget.patch.rule, patchDraft.rule),
          note: sameRuleTarget
            ? `同类反馈已合并到现有规则草稿；草稿池上限 ${RULE_PATCH_DRAFT_LIMIT} 条。`
            : `草稿池达到 ${RULE_PATCH_DRAFT_LIMIT} 条上限，新增反馈已合并到最近规则草稿。`,
        }
      : patchDraft;
  const nextRulePatches = capMergeTarget
    ? patches.map((item, index) => (index === capMergeTarget.index ? patch : item))
    : [...patches, patch];
  const patchTrace = await captureRuntimeLLMTrace({
    provider: patchResponse.provider,
    model: patchResponse.model,
    promptVersion: patchResponse.promptVersion,
    nodeType: "rule_patch_compilation",
    runId: run.id,
    inputRefs: [input.candidateId, ...feedback.map((item) => item.id)],
    outputArtifact: {
      id: patch.id,
      kind: "rule_patch",
      label: "规则草稿",
      summary: patch.note,
      ref: run.id,
    },
    metadata: {
      feedbackCount: feedback.length,
      draftPoolSize: nextRulePatches.filter((item) => item.status === "draft").length,
      merged: Boolean(capMergeTarget),
      fallback: patchResponse.provider.includes("fallback"),
    },
    upstreamTraceId: patchResponse.traceId,
    latencyMs: patchResponse.latencyMs,
    llmResponse: patchResponse,
  });
  const updated: WritingRunRecord = {
    ...run,
    updatedAt: now(),
    status: "rule_patch_ready",
    feedback: run.feedback.map((item) =>
      patch.feedbackIds.includes(item.id)
        ? { ...item, status: "compiled", rulePatchId: patch.id }
        : item,
    ),
    rulePatches: nextRulePatches,
    ruleSnapshots: normalizedRuleSnapshots(run),
    generationRuns: normalizedGenerationRuns(run),
    frameworkRuns: [
      ...(run.frameworkRuns ?? []),
      rulePatchFrameworkRun(run, patch, patchTrace),
    ],
    llmTraces: [...(run.llmTraces ?? []), patchTrace],
    rulesCandidate: {
      ...run.rulesCandidate,
      version: rulesCandidateVersion(run),
      iterationCount: nextRulePatches.length,
      updateNote: patch.note,
    },
    trace: [
      ...run.trace,
      trace("rule_patch.created", patch.id, patch.note, "L2"),
      trace("feedback.compiled", patch.feedbackIds.join(", ") || "none", "反馈已编译为规则草稿"),
    ],
  };

  await persistRun(updated);
  return updated;
}

export async function runGenerationBatch(runId: string, input: RunGenerationBatchInput = {}) {
  const run = await readWritingRun(runId);
  const nextRound = (run.round ?? 1) + 1;
  const patches = normalizedRulePatches(run);
  const patchIds =
    input.patchIds?.length
      ? input.patchIds
      : patches.filter((patch) => patch.status === "draft").map((patch) => patch.id);
  const appliedPatches = patches.filter((patch) => patchIds.includes(patch.id));
  const ruleSnapshots = normalizedRuleSnapshots(run);
  const previousSnapshot = ruleSnapshots.at(-1) ?? initialRuleSnapshot(run.id, run.createdAt, run.precheckRun);
  const nextRules = capRuleSnapshotRules([...previousSnapshot.rules, ...appliedPatches.map((patch) => patch.rule)]);
  const nextRuleSnapshot: RuleSnapshotRecord = {
    id: `rule_snapshot_${run.id}_r${nextRound}`,
    at: now(),
    version: `rules-v${ruleSnapshots.length + 1}`,
    status: "active",
    rules: nextRules,
    sourcePatchIds: appliedPatches.map((patch) => patch.id),
  };
  const adjustment = feedbackSummary(
    run,
    undefined,
    appliedPatches.flatMap((patch) => patch.feedbackIds),
  );
  const nextRulesVersion = `${run.skillPackage.version}-candidate-r${nextRound}`;
  const nextPrecheckRun: PrecheckRun = {
    ...run.precheckRun,
    id: `${run.precheckRun.id}_r${nextRound}`,
    status: "confirmed",
    contentBrief: `${run.precheckRun.contentBrief}。第 ${nextRound} 批：${adjustment.updateNote}`,
    writingRulesCandidate: nextRules,
  };
  const baseRun: WritingRunRecord = {
    ...run,
    round: nextRound,
    precheckRun: nextPrecheckRun,
    rulePatches: patches.map((patch) =>
      patchIds.includes(patch.id) ? { ...patch, status: "applied" } : patch,
    ),
    ruleSnapshots: [...ruleSnapshots, nextRuleSnapshot],
    generationRuns: normalizedGenerationRuns(run),
    rulesCandidate: {
      ...run.rulesCandidate,
      version: nextRulesVersion,
      iterationCount: patches.length,
      updateNote:
        appliedPatches.length > 0
          ? `已应用 ${appliedPatches.length} 条规则草稿，生成第 ${nextRound} 批候选。`
          : `未应用新规则，使用 ${previousSnapshot.version} 生成第 ${nextRound} 批候选。`,
    },
  };
  const candidateGeneration = await generateCandidates(baseRun, nextRuleSnapshot, input.candidateCount ?? 3);
  const { candidates } = candidateGeneration;
  const evalRun = buildEvalRun(baseRun, candidates);
  const candidateTrace = await attachCandidateEvalScores({
    runId: run.id,
    round: nextRound,
    evalRun,
    trace: await captureRuntimeLLMTrace({
      provider: candidateGeneration.response.provider,
      model: candidateGeneration.response.model,
      promptVersion: candidateGeneration.response.promptVersion,
      nodeType: "candidate_generation",
      runId: run.id,
      inputRefs: ["precheck_candidate", nextRuleSnapshot.id, ...appliedPatches.map((patch) => patch.id)],
      outputArtifact: {
        id: `candidate_artifacts_${run.id}_r${nextRound}`,
        kind: "candidate_batch",
        label: "候选批次",
        summary: `${candidates.length} 个候选版本；第 ${nextRound} 批`,
        ref: run.id,
      },
      evalResult: {
        id: evalRun.id,
        kind: "candidate_auto_eval",
        status: "complete",
        score: null,
      },
      upstreamTraceId: candidateGeneration.response.traceId,
      latencyMs: candidateGeneration.response.latencyMs,
      llmResponse: candidateGeneration.response,
      metadata: {
        candidateCount: candidates.length,
        round: nextRound,
        appliedPatchCount: appliedPatches.length,
        warning: candidateGeneration.response.output.warning,
        fallback: candidateGeneration.response.provider.includes("fallback"),
      },
    }),
  });
  const generationRun: GenerationRunRecord = {
    id: `generation_${run.id}_r${nextRound}`,
    at: now(),
    round: nextRound,
    status: "complete",
    ruleSnapshotId: nextRuleSnapshot.id,
    candidateIds: candidates.map((candidate) => candidate.id),
    evalRunId: evalRun.id,
  };
  const updated: WritingRunRecord = {
    ...baseRun,
    updatedAt: now(),
    status: "candidate_ready",
    candidates: [...run.candidates, ...candidates],
    evalRun,
    generationRuns: [...normalizedGenerationRuns(run), generationRun],
    frameworkRuns: [
      ...(run.frameworkRuns ?? []),
      candidateFrameworkRun(baseRun, evalRun, candidates.map((candidate) => candidate.id), candidateTrace),
    ],
    llmTraces: [...(run.llmTraces ?? []), candidateTrace],
    trace: [
      ...run.trace,
      trace(
        "generation_run.started",
        `${run.round ?? 1}->${nextRound}:${nextRuleSnapshot.id}`,
        `第 ${nextRound} 批候选已生成`,
      ),
      trace(
        "rule_snapshot.created",
        nextRuleSnapshot.id,
        appliedPatches.length > 0 ? "规则草稿已应用为新快照" : "无新增规则，生成对照快照",
        "L2",
      ),
      trace("candidate.generated", candidates.map((candidate) => candidate.id).join(", "), "新一批候选版本已生成"),
      trace("eval.completed", evalRun.id, "新一批评分运行已完成归因", "L2"),
    ],
  };

  await persistRun(updated);
  return updated;
}

export async function finalizeWritingRun(runId: string, input: FinalizeWritingRunInput) {
  const run = await readWritingRun(runId);
  const candidate = run.candidates.find((item) => item.id === input.candidateId);

  if (!candidate) {
    throw new Error(`找不到候选：${input.candidateId}`);
  }

  const updated: WritingRunRecord = {
    ...run,
    updatedAt: now(),
    status: "finalized",
    finalizedCandidateId: candidate.id,
    finalizedAt: now(),
    rulePatches: normalizedRulePatches(run),
    ruleSnapshots: normalizedRuleSnapshots(run),
    generationRuns: normalizedGenerationRuns(run),
    trace: [
      ...run.trace,
      trace("candidate.finalized", candidate.id, "本次文本产物已定稿并导出"),
    ],
  };

  await persistRun(updated);
  return updated;
}

export async function recordHumanFeedback(runId: string, input: HumanFeedbackInput) {
  const run = await readWritingRun(runId);
  const baseFeedback: HumanFeedbackRecord = {
    id: shortId("feedback"),
    at: now(),
    candidateId: input.candidateId,
    kind: input.kind ?? "score",
    score: typeof input.score === "number" ? input.score : null,
    note: input.note ?? "用户在候选评审区录入人工反馈。",
    status: "unprocessed",
    quote: input.quote,
    verdict: input.verdict,
    businessReason: input.businessReason,
    likelyCause: input.likelyCause,
    issue: input.issue,
    expected: input.expected,
    confidence: input.confidence,
  };
  const candidate = run.candidates.find((item) => item.id === input.candidateId);
  const feedbackAnalysis = await getLLMProvider().analyzeFeedback({
    jobSpec: run.jobSpec,
    precheckRun: run.precheckRun,
    candidate,
    feedback: baseFeedback,
  });
  const feedback: HumanFeedbackRecord = {
    ...baseFeedback,
    note: feedbackAnalysis.output.note || baseFeedback.note,
    businessReason: feedbackAnalysis.output.businessReason ?? baseFeedback.businessReason,
    likelyCause: feedbackAnalysis.output.likelyCause ?? baseFeedback.likelyCause,
    issue: feedbackAnalysis.output.issue ?? baseFeedback.issue,
    expected: feedbackAnalysis.output.expected ?? baseFeedback.expected,
    confidence: feedbackAnalysis.output.confidence ?? baseFeedback.confidence,
  };
  const feedbackLedger = [...run.feedback, feedback];
  const scoredFeedback = feedbackLedger.filter(
    (item): item is HumanFeedbackRecord & { score: number } =>
      typeof item.score === "number",
  );
  const meanHumanScore =
    scoredFeedback.length > 0
      ? scoredFeedback.reduce((sum, item) => sum + item.score, 0) / scoredFeedback.length
      : null;
  const updateNote =
    feedback.kind === "selection"
      ? `收到选中文本反馈：${feedback.businessReason ?? "原因待确认"}；下一轮优先检查 ${feedback.candidateId} 的局部表达。`
      : `收到 ${feedbackLedger.length} 条人工反馈；下一轮优先校准 ${feedback.candidateId} 的偏好信号。`;
  const feedbackTrace = await attachHumanFeedbackScore({
    runId: run.id,
    feedback,
    trace: await captureRuntimeLLMTrace({
      provider: feedbackAnalysis.provider,
      model: feedbackAnalysis.model,
      promptVersion: feedbackAnalysis.promptVersion,
      nodeType: "feedback_reasoning",
      runId: run.id,
      inputRefs: [feedback.candidateId, "selected_quote", "eval_profile"],
      outputArtifact: {
        id: feedback.id,
        kind: "human_feedback",
        label: "人工反馈",
        summary: `${feedback.kind} / ${feedback.businessReason ?? feedback.score ?? "无评分"}`,
        ref: run.id,
      },
      metadata: {
        feedbackKind: feedback.kind,
        hasQuote: Boolean(feedback.quote),
        confidence: feedback.confidence ?? null,
        fallback: feedbackAnalysis.provider.includes("fallback"),
        upstreamTraceId: feedbackAnalysis.traceId,
        latencyMs: feedbackAnalysis.latencyMs ?? 0,
      },
      upstreamTraceId: feedbackAnalysis.traceId,
      latencyMs: feedbackAnalysis.latencyMs,
      llmResponse: feedbackAnalysis,
    }),
  });
  const updated: WritingRunRecord = {
    ...run,
    updatedAt: now(),
    status: "feedback_recorded",
    feedback: feedbackLedger,
    rulesCandidate: {
      ...run.rulesCandidate,
      version: rulesCandidateVersion(run),
      iterationCount: feedbackLedger.length,
      meanHumanScore: meanHumanScore === null ? null : Number(meanHumanScore.toFixed(2)),
      updateNote,
    },
    frameworkRuns: [...(run.frameworkRuns ?? []), feedbackFrameworkRun(run, feedback, feedbackTrace)],
    llmTraces: [...(run.llmTraces ?? []), feedbackTrace],
    trace: [
      ...run.trace,
      trace(
        "feedback.recorded",
        `${feedback.candidateId}:${feedback.kind}:${feedback.businessReason ?? feedback.score ?? "no-score"}`,
        "人工反馈已追加到账本",
      ),
      trace("rules_candidate.updated", run.rulesCandidate.id, "写作规则候选已按反馈更新", "L2"),
    ],
  };

  await persistRun(updated);
  return updated;
}

export async function deleteHumanFeedback(runId: string, feedbackId: string) {
  const run = await readWritingRun(runId);
  const feedbackLedger = run.feedback.filter((item) => item.id !== feedbackId);
  const scoredFeedback = feedbackLedger.filter(
    (item): item is HumanFeedbackRecord & { score: number } =>
      typeof item.score === "number",
  );
  const meanHumanScore =
    scoredFeedback.length > 0
      ? scoredFeedback.reduce((sum, item) => sum + item.score, 0) / scoredFeedback.length
      : null;
  const updated: WritingRunRecord = {
    ...run,
    updatedAt: now(),
    status:
      feedbackLedger.length > 0
        ? "feedback_recorded"
        : run.candidates.length > 0
          ? "candidate_ready"
          : run.status,
    feedback: feedbackLedger,
    rulesCandidate: {
      ...run.rulesCandidate,
      version: rulesCandidateVersion(run),
      iterationCount: feedbackLedger.length,
      meanHumanScore: meanHumanScore === null ? null : Number(meanHumanScore.toFixed(2)),
      updateNote:
        feedbackLedger.length > 0
          ? `已撤回 1 条反馈；当前保留 ${feedbackLedger.length} 条人工反馈。`
          : "人工反馈已清空；等待新的局部反馈。",
    },
    trace: [
      ...run.trace,
      trace("feedback.deleted", feedbackId, "人工反馈已从账本撤回"),
      trace("rules_candidate.updated", run.rulesCandidate.id, "写作规则候选已按反馈撤回重新计算", "L2"),
    ],
  };

  await persistRun(updated);
  return updated;
}
