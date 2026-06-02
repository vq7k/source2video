import { createHash, randomUUID } from "node:crypto";

import { getLLMProvider } from "@doc-maker/writing-domain/llm/provider";
import type { CandidateDraft, LLMProviderResponse, CandidateGenerationDraft, PrecheckDraft } from "@doc-maker/writing-domain/llm/types";
import { jsonRulePackageStore } from "@doc-maker/writing-domain/rule-package-store";
import { jsonRunStore } from "@doc-maker/writing-domain/run-store";
import { bindTraceToRun } from "@doc-maker/observability/trace-sink";
import {
  buildWritingCandidateEvalRun,
  scoreWritingCandidate,
  writeWritingCandidateEvalScores,
  writeWritingHumanFeedbackScore,
} from "@doc-maker/writing-domain/eval-adapter";
import {
  candidateBatchFrameworkRun,
  candidateEvalFrameworkRun,
  candidateGenerationFrameworkRun,
  captureRuntimeLLMTrace,
  feedbackFrameworkRun,
  normalizeFrameworkTraceBindings,
  precheckFrameworkRun,
  rulePatchFrameworkRun,
  scopeFrameworkRun,
} from "@doc-maker/writing-domain/framework-trace";
import {
  RULE_PATCH_DRAFT_LIMIT,
  RULE_SNAPSHOT_RULE_LIMIT,
} from "@doc-maker/writing-domain/types";
import type {
  CandidateRecord,
  CompileRulePatchInput,
  CreateRulePackageDraftInput,
  CreateWritingRunInput,
  FinalizeWritingRunInput,
  GenerationRunRecord,
  HumanFeedbackInput,
  HumanFeedbackRecord,
  PrecheckRun,
  RuleScopeExtractionEval,
  RulePatchRecord,
  RulePackageRecord,
  RulePackageRule,
  RuleSnapshotRecord,
  RecordTopicContextInput,
  RunGenerationBatchInput,
  TextOutputContract,
  TopicContextRecord,
  TraceStep,
  DeriveWritingRuleScopeInput,
  SkillPackageSnapshot,
  WritingRuleScopeRecord,
  OutputProfileSnapshot,
  WritingRulesCandidateRecord,
  WritingRunRecord,
  PublishRulePackageInput,
} from "@doc-maker/writing-domain/types";
import type { LLMCallTraceRecord } from "@doc-maker/writing-domain/framework-run-types";

const BASELINE_OUTPUT_CONTRACT: TextOutputContract = {
  artifactType: "",
  lengthRange: "",
  structure: "",
  formatRules: "",
  groundingRules: "",
  specialHandling: "",
  downstreamHandoff: "",
};

const BASELINE_SKILL_PACKAGE: SkillPackageSnapshot = {
  id: "baseline-no-package",
  category: "本次文本",
  version: "Baseline / No Published Rule Package",
  status: "baseline mode",
};

const BASELINE_OUTPUT_PROFILE: OutputProfileSnapshot = {
  name: "文本产物",
  artifacts: ["text_artifact"],
};

const TOPIC_CONTEXT_LIMIT = 8;
const TOPIC_CONTEXT_TEXT_LIMIT = 240;

function draftJobSpec(input: DeriveWritingRuleScopeInput): CreateWritingRunInput["jobSpec"] {
  const firstLine = input.quickIntake.split("\n").find((line) => line.trim())?.trim() ?? "";
  const title = firstLine.length > 52 ? `${firstLine.slice(0, 52)}...` : firstLine;

  return {
    title: input.jobSpec?.title || title || "未命名草稿",
    goal: input.jobSpec?.goal ?? "",
    source: input.jobSpec?.source || input.quickIntake || "",
    writingReference: input.jobSpec?.writingReference || "",
    reviewPreference: input.jobSpec?.reviewPreference || "",
  };
}

function outputContractFor(inputOrRun: { outputContract?: TextOutputContract }) {
  return inputOrRun.outputContract ?? BASELINE_OUTPUT_CONTRACT;
}

function isTemplateRuleSource(skillPackage?: SkillPackageSnapshot) {
  return Boolean(skillPackage && skillPackage.id !== BASELINE_SKILL_PACKAGE.id);
}

function now() {
  return new Date().toISOString();
}

function shortId(prefix: string) {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
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
      executionMode: "legacy_batch_generation",
    },
  ];
}

function normalizedRulePackages(run: WritingRunRecord): RulePackageRecord[] {
  return Array.isArray(run.rulePackages) ? run.rulePackages : [];
}

function normalizedTopicContext(run: Partial<WritingRunRecord>): TopicContextRecord[] {
  return Array.isArray(run.userProvidedContext)
    ? run.userProvidedContext
        .filter((item): item is TopicContextRecord => Boolean(item?.id && item.text?.trim()))
        .map((item) => ({
          ...item,
          source: item.source ?? "user",
          status: item.status ?? "active",
          round: item.round ?? 1,
        }))
    : [];
}

function draftPrecheckRun(runId: string): PrecheckRun {
  return {
    id: `precheck_${runId}`,
    status: "ready",
    warning: "Draft Job 尚未进入生成前检查。",
    contentBrief: "",
    groundingBrief: "",
    writingRulesCandidate: [],
    riskChecks: [],
  };
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
    userProvidedContext: normalizedTopicContext(legacyRun),
    rulePatches: Array.isArray(legacyRun.rulePatches) ? legacyRun.rulePatches : [],
    ruleSnapshots: [],
    rulePackages: Array.isArray(legacyRun.rulePackages) ? legacyRun.rulePackages : [],
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
        executionMode: generationRun.executionMode ??
          (
            Array.isArray(generationRun.candidateNodeRunIds) &&
            generationRun.candidateNodeRunIds.length > 1 &&
            Array.isArray(generationRun.evalNodeRunIds) &&
            generationRun.evalNodeRunIds.length > 1
              ? "independent_candidate_paths"
              : "legacy_batch_generation"
          ),
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

async function ruleScopeFromTemplate({
  runId,
  skillPackage,
  jobSpec,
}: {
  runId: string;
  skillPackage: SkillPackageSnapshot;
  jobSpec?: CreateWritingRunInput["jobSpec"];
}): Promise<WritingRuleScopeRecord> {
  const createdAt = now();
  const scopeId = shortId("rule_scope");
  const packageRules = skillPackage.rules?.filter(Boolean) ?? [];
  const templateItems: WritingRuleScopeRecord["items"] =
    packageRules.length > 0
      ? packageRules.slice(0, 6).map((rule) => ({
          id: shortId("scope_item"),
          kind: "checklist" as const,
          text: rule,
          sourceNote: `规则包 ${skillPackage.version}`,
          confidence: "high" as const,
        }))
      : [
          {
            id: shortId("scope_item"),
            kind: "structure",
            text: jobSpec?.writingReference || `${skillPackage.category} 模板规则：复用已发布/已确认的结构和表达边界。`,
            sourceNote: `来自模板 ${skillPackage.version}`,
            confidence: "high",
          },
          {
            id: shortId("scope_item"),
            kind: "checklist",
            text: jobSpec?.reviewPreference || "按模板绑定的评审偏好检查候选，不在本轮自动提炼新规则。",
            sourceNote: `来自模板 ${skillPackage.version}`,
            confidence: "high",
          },
          {
            id: shortId("scope_item"),
            kind: "prohibition",
            text: "选择模板复用后，本轮不自动生成新的 Rule Scope；如需变化，必须由用户手动编辑或重新提炼。",
            sourceNote: "模板复用边界",
            confidence: "high",
          },
        ];
  const items = templateItems.filter((item) => item.text.trim().length > 0);
  const evalRecord: RuleScopeExtractionEval = {
    id: shortId("scope_eval"),
    status: "complete",
    score: 100,
    checks: [
      {
        label: "template-loaded",
        status: "pass",
        evidence: skillPackage.id,
        guidance: "规则来自已选模板，未触发 Rule Scope LLM 调用。",
      },
    ],
  };
  const llmTrace = await captureRuntimeLLMTrace({
    provider: "rule-template",
    model: "no-llm",
    promptVersion: "template-rule-scope-v0.1",
    nodeType: "template_rule_scope_load",
    inputRefs: ["selected_rule_template"],
    outputArtifact: {
      id: scopeId,
      kind: "writing_rule_scope",
      label: "模板规则范围",
      summary: `${skillPackage.category} / ${skillPackage.version}`,
    },
    evalResult: {
      id: evalRecord.id,
      kind: "template_rule_scope_eval",
      status: "complete",
      score: evalRecord.score,
    },
    runId,
    metadata: {
      skillPackageId: skillPackage.id,
      noLLMCall: true,
    },
  });

  return {
    id: scopeId,
    createdAt,
    status: "draft",
    source: "template",
    quickIntakeDigest: digest(jobSpec?.goal ?? ""),
    items,
    eval: evalRecord,
    llmTrace,
    warning: "已选择规则模板，本轮不自动提炼规则；如需变化，请手动编辑或重新提炼。",
  };
}

export async function createDraftWritingRun(input: DeriveWritingRuleScopeInput): Promise<WritingRunRecord> {
  const id = input.runId ?? shortId("run");
  const createdAt = input.runId
    ? (await jsonRunStore.get(input.runId).catch(() => null))?.createdAt ?? now()
    : now();
  const updatedAt = now();
  const skillPackage = input.skillPackage ?? BASELINE_SKILL_PACKAGE;
  const scope = isTemplateRuleSource(skillPackage)
    ? await ruleScopeFromTemplate({ runId: id, skillPackage, jobSpec: input.jobSpec })
    : await deriveWritingRuleScope({
        ...input,
        runId: id,
      });
  const draftScope: WritingRuleScopeRecord = {
    ...scope,
    status: "draft",
    llmTrace: bindTraceToRun(scope.llmTrace, id),
  };
  const jobSpec = draftJobSpec(input);
  const outputProfile = input.outputProfile ?? BASELINE_OUTPUT_PROFILE;
  const outputContract = outputContractFor(input);
  const run: WritingRunRecord = {
    id,
    createdAt,
    updatedAt,
    status: "draft_scope_ready",
    round: 1,
    storePath: storePathFor(id),
    quickIntake: input.quickIntake,
    referencePaste: input.referencePaste?.trim() || draftScope.referencePaste,
    ruleScope: draftScope,
    skillPackage,
    outputProfile,
    outputContract,
    jobSpec,
    precheckRun: draftPrecheckRun(id),
    candidates: [],
    evalRun: null,
    feedback: [],
    userProvidedContext: [],
    rulePatches: [],
    ruleSnapshots: [],
    rulePackages: [],
    generationRuns: [],
    rulesCandidate: {
      id: `rules_candidate_${skillPackage.id}`,
      status: "candidate",
      version: `${skillPackage.version}-draft`,
      iterationCount: 0,
      meanHumanScore: null,
      updateNote: "Draft Job：规则范围已生成，等待确认进入 Precheck。",
    },
    frameworkRuns: [scopeFrameworkRun(draftScope)],
    llmTraces: [draftScope.llmTrace],
    trace: [
      trace("draft.created", input.quickIntake, "规则范围已生成并保存为 Draft Job"),
      trace("rule_scope.generated", draftScope.id, `${draftScope.items.length} 条临时规则等待确认`),
    ],
  };

  await persistRun(run);
  return run;
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

function candidateRecordFromDraft(
  run: WritingRunRecord,
  ruleSnapshot: RuleSnapshotRecord,
  draft: CandidateDraft,
  index: number,
): CandidateRecord {
  const round = run.round ?? 1;

  return {
    id: `candidate_r${round}_${index + 1}`,
    round,
    runId: `generation_${run.id}_r${round}_v${index + 1}`,
    generatedByRuleSnapshotId: ruleSnapshot.id,
    version: `第 ${round} 批 · 版本 ${index + 1}`,
    title: draft.title,
    summary: draft.summary,
    excerpt: draft.excerpt,
    total: 0,
    humanScore: "pending_eval",
    breakdown: {
      quality: 0,
      fit: 0,
      style: 0,
      risk: 0,
    },
    rationale: draft.rationale,
    risk: draft.risk,
    feedbackApplied: normalizedRulePatches(run)
      .filter((patch) => ruleSnapshot.sourcePatchIds.includes(patch.id))
      .map((patch) => patch.rule),
  };
}

const CANDIDATE_VARIANT_INSTRUCTIONS = [
  "主线清晰版：先给核心判断，再顺序解释机制和定位。",
  "证据边界版：更强调来源边界、可追溯依据和风险控制。",
  "口播节奏版：更短句、更强节奏，适合直接朗读。",
];

type CandidatePathGeneration = {
  candidate: CandidateRecord;
  trace: LLMCallTraceRecord;
  response: LLMProviderResponse<CandidateGenerationDraft>;
};

type CandidatePathFailure = {
  index: number;
  trace: LLMCallTraceRecord;
  error: string;
};

async function generateCandidatePath(
  run: WritingRunRecord,
  ruleSnapshot: RuleSnapshotRecord,
  index: number,
  variantCount: number,
): Promise<CandidatePathGeneration | CandidatePathFailure> {
  const variantInstruction =
    CANDIDATE_VARIANT_INSTRUCTIONS[index] ?? `独立候选路径 ${index + 1}`;
  const activeTopicContext = normalizedTopicContext(run).filter((item) => item.status === "active");
  const inputRefs = [
    "precheck_candidate",
    ruleSnapshot.id,
    ...activeTopicContext.map((item) => item.id),
    ...normalizedRulePatches(run)
      .filter((patch) => ruleSnapshot.sourcePatchIds.includes(patch.id))
      .map((patch) => patch.id),
  ];

  try {
    const response = await getLLMProvider().generateCandidates({
      round: run.round ?? 1,
      candidateCount: 1,
      variantIndex: index,
      variantCount,
      variantInstruction,
      jobSpec: run.jobSpec,
      outputContract: outputContractFor(run),
      outputProfile: run.outputProfile,
      skillPackage: run.skillPackage,
      precheckRun: run.precheckRun,
      ruleScope: run.ruleScope,
      ruleSnapshot,
      userProvidedContext: activeTopicContext,
      feedback: run.feedback,
      rulePatches: normalizedRulePatches(run),
    });
    const draft = response.output.candidates[0];
    if (!draft) {
      throw new Error("模型未返回候选正文。");
    }

    const candidate = candidateRecordFromDraft(run, ruleSnapshot, draft, index);
    const traceRecord = await captureRuntimeLLMTrace({
      provider: response.provider,
      model: response.model,
      promptVersion: response.promptVersion,
      nodeType: "candidate_generation",
      runId: run.id,
      inputRefs,
      outputArtifact: {
        id: candidate.id,
        kind: "candidate_text",
        label: "候选正文",
        summary: `第 ${run.round ?? 1} 批 / 独立路径 ${index + 1}/${variantCount}`,
        ref: run.id,
      },
      evalResult: {
        id: `eval_pending_${candidate.id}`,
        kind: "candidate_generation_no_score",
        status: "skipped",
        score: null,
      },
      upstreamTraceId: response.traceId,
      latencyMs: response.latencyMs,
      llmResponse: response,
      metadata: {
        candidateId: candidate.id,
        candidateIndex: index + 1,
        candidateCount: variantCount,
        variantInstruction,
        independentPath: true,
        warning: response.output.warning,
        fallback: response.provider.includes("fallback"),
      },
    });

    return { candidate, trace: traceRecord, response };
  } catch (error) {
    const message = error instanceof Error ? error.message : "candidate generation failed";
    const traceRecord = await captureRuntimeLLMTrace({
      status: "failed",
      provider: "runtime",
      model: "unknown",
      promptVersion: "candidate-generation-v0.3",
      nodeType: "candidate_generation",
      runId: run.id,
      inputRefs,
      outputArtifact: {
        id: `candidate_failed_${run.id}_r${run.round ?? 1}_v${index + 1}`,
        kind: "candidate_generation_error",
        label: "候选生成失败",
        summary: message,
        ref: run.id,
      },
      metadata: {
        candidateIndex: index + 1,
        candidateCount: variantCount,
        variantInstruction,
        independentPath: true,
        error: message,
      },
    });

    return { index, trace: traceRecord, error: message };
  }
}

async function generateCandidatePaths(
  run: WritingRunRecord,
  ruleSnapshot: RuleSnapshotRecord,
  candidateCount = 3,
): Promise<{
  candidates: CandidateRecord[];
  paths: CandidatePathGeneration[];
  traces: LLMCallTraceRecord[];
  failures: CandidatePathFailure[];
}> {
  const results = await Promise.all(
    Array.from({ length: candidateCount }, (_, index) =>
      generateCandidatePath(run, ruleSnapshot, index, candidateCount),
    ),
  );
  const generated = results.filter(
    (item): item is CandidatePathGeneration => "candidate" in item,
  );
  const failures = results.filter(
    (item): item is CandidatePathFailure => "error" in item,
  );

  if (!generated.length) {
    throw new Error(`候选生成全部失败：${failures.map((item) => item.error).join(" / ")}`);
  }

  return {
    candidates: generated.map((item) => item.candidate),
    paths: generated,
    traces: results.map((item) => item.trace),
    failures,
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

function applyIndependentEvalToCandidate(run: WritingRunRecord, candidate: CandidateRecord) {
  const scored = scoreWritingCandidate({
    candidate,
    outputContract: outputContractFor(run),
    jobSpec: run.jobSpec,
    precheckRun: run.precheckRun,
  });

  return {
    ...candidate,
    total: scored.total,
    humanScore: "pending",
    breakdown: {
      quality: scored.scores.quality,
      fit: scored.scores.fit,
      style: scored.scores.style,
      risk: scored.scores.risk,
    },
  };
}

async function evaluateCandidatePath(run: WritingRunRecord, candidate: CandidateRecord) {
  const round = run.round ?? candidate.round ?? 1;
  const scoredCandidate = applyIndependentEvalToCandidate(run, candidate);
  const evalRun = buildEvalRun(run, [scoredCandidate]);
  const result = evalRun.candidateResults[0];
  const evalTrace = await attachCandidateEvalScores({
    runId: run.id,
    round,
    evalRun,
    trace: await captureRuntimeLLMTrace({
      provider: "workflow-core",
      model: "deterministic-writing-eval-v0.1",
      promptVersion: "candidate-eval-v0.1",
      nodeType: "candidate_eval",
      runId: run.id,
      inputRefs: [
        candidate.id,
        "eval_profile",
        "precheck_candidate",
        candidate.generatedByRuleSnapshotId ?? "rule_snapshot",
      ],
      outputArtifact: {
        id: evalRun.id,
        kind: "candidate_eval",
        label: "候选评估",
        summary: `${candidate.id} / ${result?.total ?? "待评估"}`,
        ref: run.id,
      },
      evalResult: {
        id: evalRun.id,
        kind: "candidate_eval",
        status: "complete",
        score: result?.total ?? null,
      },
      llmResponse: {
        requestPayload: {
          candidateId: candidate.id,
          outputContract: outputContractFor(run),
          precheckRun: run.precheckRun,
        },
        responsePayload: {
          evalRun,
        },
      },
      metadata: {
        candidateId: candidate.id,
        round,
        independentEval: true,
      },
    }),
  });

  return {
    candidate: scoredCandidate,
    evalRun,
    trace: evalTrace,
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
  const existingDraft = input.draftRunId
    ? await jsonRunStore.get(input.draftRunId).catch(() => null)
    : null;
  const id = input.draftRunId ?? shortId("run");
  const createdAt = existingDraft?.createdAt ?? now();
  const derivedScope =
    input.ruleScope ??
    (isTemplateRuleSource(input.skillPackage)
      ? await ruleScopeFromTemplate({ runId: id, skillPackage: input.skillPackage, jobSpec: input.jobSpec })
      : await deriveWritingRuleScope({
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
    userProvidedContext: [],
    rulePatches: [],
    ruleSnapshots: [ruleSnapshot],
    rulePackages: [],
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
      ...(existingDraft?.trace ?? []),
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

export async function recordTopicContext(runId: string, input: RecordTopicContextInput) {
  const run = await readWritingRun(runId);
  const text = input.text.trim().replace(/\s+/g, " ");
  const limitedText =
    text.length > TOPIC_CONTEXT_TEXT_LIMIT
      ? `${text.slice(0, TOPIC_CONTEXT_TEXT_LIMIT)}...`
      : text;
  const currentContext = normalizedTopicContext(run);
  const activeContext = currentContext.filter((item) => item.status === "active");
  const duplicate = activeContext.find((item) => item.text === limitedText);

  if (duplicate) {
    return run;
  }

  const contextRecord: TopicContextRecord = {
    id: shortId("topic_context"),
    at: now(),
    round: run.round ?? 1,
    text: limitedText,
    source: input.source ?? "user",
    status: "active",
  };
  const nextActiveContext = [...activeContext, contextRecord].slice(-TOPIC_CONTEXT_LIMIT);
  const archivedContext = currentContext.filter((item) => item.status === "archived");
  const updated: WritingRunRecord = {
    ...run,
    updatedAt: now(),
    userProvidedContext: [...archivedContext, ...nextActiveContext],
    trace: [
      ...run.trace,
      trace(
        "topic_context.added",
        contextRecord.id,
        "用户补充上下文已写入 Topic Boundary，下一轮生成必须优先遵守",
      ),
    ],
  };

  await persistRun(updated);
  return updated;
}

export async function confirmWritingRunPrecheck(runId: string) {
  const run = await readWritingRun(runId);
  const normalizedRun = { ...run, round: run.round ?? 1 };
  const ruleSnapshots = normalizedRuleSnapshots(normalizedRun);
  const activeRuleSnapshot = ruleSnapshots.at(-1) ?? initialRuleSnapshot(run.id, run.createdAt, run.precheckRun);
  const candidateGeneration = await generateCandidatePaths(normalizedRun, activeRuleSnapshot);
  const evaluated = await Promise.all(
    candidateGeneration.candidates.map((candidate) => evaluateCandidatePath(normalizedRun, candidate)),
  );
  const candidates = evaluated.map((item) => item.candidate);
  const evalRun = buildEvalRun(normalizedRun, candidates);
  const generationRun: GenerationRunRecord = {
    id: `generation_${run.id}_r${normalizedRun.round}`,
    at: now(),
    round: normalizedRun.round,
    status: "complete",
    ruleSnapshotId: activeRuleSnapshot.id,
    candidateIds: candidates.map((candidate) => candidate.id),
    evalRunId: evalRun.id,
    candidateNodeRunIds: candidateGeneration.traces.map((item) => item.nodeRunId).filter(Boolean) as string[],
    evalNodeRunIds: evaluated.map((item) => item.trace.nodeRunId).filter(Boolean) as string[],
    executionMode: "independent_candidate_paths",
  };
  const generationFrameworkRuns = candidateGeneration.paths.map((path) =>
    candidateGenerationFrameworkRun(normalizedRun, path.candidate, path.trace),
  );
  const evalFrameworkRuns = evaluated.map((item) =>
    candidateEvalFrameworkRun(normalizedRun, item.candidate, item.evalRun, item.trace),
  );
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
      ...generationFrameworkRuns,
      ...evalFrameworkRuns,
      candidateBatchFrameworkRun(normalizedRun, evalRun, candidates.map((candidate) => candidate.id)),
    ],
    llmTraces: [
      ...(run.llmTraces ?? []),
      ...candidateGeneration.traces,
      ...evaluated.map((item) => item.trace),
    ],
    trace: [
      ...run.trace,
      trace("precheck.confirmed", run.precheckRun.id, "生成前检查候选被确认为本轮生成契约"),
      trace("candidate.generated", candidates.map((candidate) => candidate.id).join(", "), "候选版本已由独立节点生成"),
      trace("eval.completed", evalRun.id, "每个候选已完成独立评估", "L2"),
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
    Array.isArray(input.patchIds)
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
    status: "confirmed",
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
  const candidateGeneration = await generateCandidatePaths(baseRun, nextRuleSnapshot, input.candidateCount ?? 3);
  const evaluated = await Promise.all(
    candidateGeneration.candidates.map((candidate) => evaluateCandidatePath(baseRun, candidate)),
  );
  const candidates = evaluated.map((item) => item.candidate);
  const evalRun = buildEvalRun(baseRun, candidates);
  const generationRun: GenerationRunRecord = {
    id: `generation_${run.id}_r${nextRound}`,
    at: now(),
    round: nextRound,
    status: "complete",
    ruleSnapshotId: nextRuleSnapshot.id,
    candidateIds: candidates.map((candidate) => candidate.id),
    evalRunId: evalRun.id,
    candidateNodeRunIds: candidateGeneration.traces.map((item) => item.nodeRunId).filter(Boolean) as string[],
    evalNodeRunIds: evaluated.map((item) => item.trace.nodeRunId).filter(Boolean) as string[],
    executionMode: "independent_candidate_paths",
  };
  const generationFrameworkRuns = candidateGeneration.paths.map((path) =>
    candidateGenerationFrameworkRun(baseRun, path.candidate, path.trace),
  );
  const evalFrameworkRuns = evaluated.map((item) =>
    candidateEvalFrameworkRun(baseRun, item.candidate, item.evalRun, item.trace),
  );
  const updated: WritingRunRecord = {
    ...baseRun,
    updatedAt: now(),
    status: "candidate_ready",
    candidates: [...run.candidates, ...candidates],
    evalRun,
    generationRuns: [...normalizedGenerationRuns(run), generationRun],
    frameworkRuns: [
      ...(run.frameworkRuns ?? []),
      ...generationFrameworkRuns,
      ...evalFrameworkRuns,
      candidateBatchFrameworkRun(baseRun, evalRun, candidates.map((candidate) => candidate.id)),
    ],
    llmTraces: [
      ...(run.llmTraces ?? []),
      ...candidateGeneration.traces,
      ...evaluated.map((item) => item.trace),
    ],
    trace: [
      ...run.trace,
      trace(
        "generation_run.started",
        `${run.round ?? 1}->${nextRound}:${nextRuleSnapshot.id}`,
        `第 ${nextRound} 批候选已由独立节点生成；${adjustment.updateNote}`,
      ),
      trace(
        "rule_snapshot.created",
        nextRuleSnapshot.id,
        appliedPatches.length > 0 ? "规则草稿已应用为新快照" : "无新增规则，生成对照快照",
        "L2",
      ),
      trace("candidate.generated", candidates.map((candidate) => candidate.id).join(", "), "新一批候选版本已由独立节点生成"),
      trace("eval.completed", evalRun.id, "每个候选已完成独立评估", "L2"),
    ],
  };

  await persistRun(updated);
  return updated;
}

function rulePackageTitle(run: WritingRunRecord) {
  const title = run.jobSpec.title || digest(run.quickIntake);
  return title.length > 34 ? `${title.slice(0, 34)}...` : title;
}

function pushRulePackageRule(
  rules: RulePackageRule[],
  seen: Set<string>,
  source: RulePackageRule["source"],
  sourceId: string,
  text: string,
) {
  const normalized = text.replace(/^反馈规则：/, "").replace(/\s+/g, " ").trim();
  if (!normalized || seen.has(normalized)) {
    return;
  }
  seen.add(normalized);
  rules.push({
    id: shortId("package_rule"),
    source,
    sourceId,
    text: normalized,
  });
}

function buildRulePackageRules(run: WritingRunRecord, candidate: CandidateRecord) {
  const rules: RulePackageRule[] = [];
  const seen = new Set<string>();

  for (const item of run.ruleScope?.items ?? []) {
    pushRulePackageRule(rules, seen, "rule_scope", item.id, `${scopeKindLabel(item.kind)}：${item.text}`);
  }
  for (const [index, rule] of run.precheckRun.writingRulesCandidate.entries()) {
    pushRulePackageRule(rules, seen, "precheck", `${run.precheckRun.id}:${index}`, rule);
  }
  for (const patch of normalizedRulePatches(run)) {
    pushRulePackageRule(rules, seen, "feedback", patch.id, patch.rule);
  }
  pushRulePackageRule(
    rules,
    seen,
    "finalized_candidate",
    candidate.id,
    `定稿正向样本：复用“${candidate.title}”的论证动作、依据边界和风险控制，不复制正文句子。`,
  );

  return rules.slice(0, RULE_SNAPSHOT_RULE_LIMIT);
}

export async function listRulePackages() {
  return (await jsonRulePackageStore.list()).filter((rulePackage) => rulePackage.status === "published");
}

export async function createRulePackageDraft(runId: string, input: CreateRulePackageDraftInput = {}) {
  const run = await readWritingRun(runId);
  const candidateId = input.candidateId ?? run.finalizedCandidateId;
  const candidate = run.candidates.find((item) => item.id === candidateId);

  if (!candidate) {
    throw new Error("创建规则包草稿需要先选择一个定稿候选。");
  }

  const createdAt = now();
  const rules = buildRulePackageRules(run, candidate);
  const rulePackage: RulePackageRecord = {
    id: shortId("rule_package"),
    createdAt,
    updatedAt: createdAt,
    status: "draft",
    title: `${rulePackageTitle(run)} 规则包`,
    category: rulePackageTitle(run) || "文本规则包",
    version: `rule-package-v${normalizedRulePackages(run).length + 1}`,
    summary: `从定稿候选、Rule Scope、Precheck 和人工反馈沉淀 ${rules.length} 条可复用规则。`,
    sourceRunId: run.id,
    finalizedCandidateId: candidate.id,
    rules,
    sourceSummary: {
      ruleScopeCount: run.ruleScope?.items.length ?? 0,
      precheckRuleCount: run.precheckRun.writingRulesCandidate.length,
      feedbackRuleCount: normalizedRulePatches(run).length,
      hasFinalizedCandidate: true,
    },
    outputContract: outputContractFor(run),
  };

  await jsonRulePackageStore.put(rulePackage);
  const updated: WritingRunRecord = {
    ...run,
    updatedAt: now(),
    rulePackages: [
      rulePackage,
      ...normalizedRulePackages(run).filter((item) => item.id !== rulePackage.id),
    ],
    trace: [
      ...run.trace,
      trace("rule_package.draft_created", rulePackage.id, `${rules.length} 条规则已生成规则包草稿`, "L2"),
    ],
  };

  await persistRun(updated);
  return { run: updated, rulePackage };
}

export async function publishRulePackage(runId: string, input: PublishRulePackageInput) {
  const run = await readWritingRun(runId);
  const storedPackage = await jsonRulePackageStore.get(input.packageId);
  const publishedAt = now();
  const rulePackage: RulePackageRecord = {
    ...storedPackage,
    status: "published",
    updatedAt: publishedAt,
    publishedAt,
  };

  await jsonRulePackageStore.put(rulePackage);
  const updated: WritingRunRecord = {
    ...run,
    updatedAt: publishedAt,
    rulePackages: [
      rulePackage,
      ...normalizedRulePackages(run).filter((item) => item.id !== rulePackage.id),
    ],
    trace: [
      ...run.trace,
      trace("rule_package.published", rulePackage.id, `${rulePackage.rules.length} 条规则已发布，可在新任务复用`, "L2"),
    ],
  };

  await persistRun(updated);
  return { run: updated, rulePackage };
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
