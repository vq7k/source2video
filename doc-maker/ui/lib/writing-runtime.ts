import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  RULE_PATCH_DRAFT_LIMIT,
  RULE_SNAPSHOT_RULE_LIMIT,
} from "@/lib/writing-run-types";
import type {
  CandidateRecord,
  CompileRulePatchInput,
  CreateWritingRunInput,
  EvalRun,
  GenerationRunRecord,
  HumanFeedbackInput,
  HumanFeedbackRecord,
  PrecheckRun,
  RulePatchRecord,
  RuleSnapshotRecord,
  RunGenerationBatchInput,
  TextOutputContract,
  TraceStep,
  WritingRunRecord,
} from "@/lib/writing-run-types";

const STORE_DIR = path.join(process.cwd(), ".writing-runs");

const BASELINE_OUTPUT_CONTRACT: TextOutputContract = {
  artifactType: "short explanatory text",
  lengthRange: "300-500 中文字（约 60-90 秒口播基准）",
  structure: "标题 + 判断开场 + 2-3 个短论证段 + 下一步",
  formatRules: "Markdown 正文；除非任务明确要求，不生成表格。",
  groundingRules: "每个关键判断必须能回指到底稿、用户输入或标注为待确认。",
  specialHandling: "不编造事实；不复制参考文句式；不确定内容标注低置信；复杂公式只标记为下游专项处理。",
  downstreamHandoff: "输出短 Text Artifact；TTS 目标 60-90 秒；Video 在下游节点独立处理。",
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
  return path.join(STORE_DIR, `${runId}.json`);
}

function skillCandidateVersion(run: WritingRunRecord) {
  return run.skillCandidate.version ?? `${run.skill.version}-candidate-r${run.round ?? 1}`;
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
      rules: run.precheckRun.writingRuleCandidate,
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

async function ensureStore() {
  await mkdir(STORE_DIR, { recursive: true });
}

async function persistRun(run: WritingRunRecord) {
  await ensureStore();
  await writeFile(storePathFor(run.id), `${JSON.stringify(run, null, 2)}\n`, "utf8");
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

function derivePrecheckRun(input: CreateWritingRunInput, runId: string): PrecheckRun {
  const { jobSpec, outputProfile } = input;
  const outputContract = outputContractFor(input);
  const hasMissingSignal = jobSpec.source.includes("缺少") || jobSpec.source.includes("不足");
  const hasUnstablePreference = jobSpec.reviewPreference.includes("不稳定");
  const hasStyleReference = jobSpec.writingReference.trim().length > 0;
  const hasSpecialHandling =
    outputContract.specialHandling.trim().length > 0 ||
    outputContract.downstreamHandoff.includes("TTS") ||
    outputContract.downstreamHandoff.includes("Video");

  return {
    id: `precheck_${runId}`,
    status: "ready",
    contentBrief: `任务：${jobSpec.title}。目标：${jobSpec.goal}`,
    groundingBrief: `底稿边界：${jobSpec.source || "未提供底稿"}。交付契约：${outputContract.artifactType} / ${outputContract.lengthRange} / ${outputContract.structure}。Handoff：${outputContract.downstreamHandoff || outputProfile.name}。`,
    writingRuleCandidate: [
      `产物：${outputContract.artifactType}；长度：${outputContract.lengthRange}；格式：${outputContract.formatRules}`,
      `依据：${outputContract.groundingRules}`,
      `结构：${input.skill.category} 默认先给判断，再给证据，最后给下一步。`,
      hasStyleReference
        ? `写法参考只提炼结构和语气：${jobSpec.writingReference}`
        : "未提供写法参考，使用 baseline 写作约束。",
      `评审偏好进入本轮 Eval Profile：${jobSpec.reviewPreference || "未提供偏好"}`,
    ],
    riskChecks: [
      {
        label: "事实缺口",
        level: hasMissingSignal ? "medium" : "low",
        reason: hasMissingSignal ? "底稿出现缺少/不足信号，需要保留为生成风险。" : "底稿可用，但仍禁止补写未知事实。",
      },
      {
        label: "相似表达",
        level: hasStyleReference ? "medium" : "low",
        reason: hasStyleReference ? "有写法参考，只允许迁移结构，不允许复制句式。" : "没有外部参考，仿写风险较低。",
      },
      {
        label: "偏好漂移",
        level: hasUnstablePreference ? "medium" : "low",
        reason: hasUnstablePreference ? "评审偏好显式不稳定，本轮规则只能保持 candidate。" : "未检测到显式偏好漂移信号。",
      },
      {
        label: "交付契约",
        level: hasSpecialHandling ? "medium" : "low",
        reason: hasSpecialHandling
          ? `存在特殊处理或下游 handoff：${outputContract.specialHandling || outputContract.downstreamHandoff}`
          : "Baseline Output Contract 可直接进入文本生成。",
      },
    ],
  };
}

function initialRuleSnapshot(runId: string, createdAt: string, precheckRun: PrecheckRun): RuleSnapshotRecord {
  return {
    id: `rule_snapshot_${runId}_r1`,
    at: createdAt,
    version: "rules-v1",
    status: "active",
    rules: precheckRun.writingRuleCandidate,
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

function generateCandidates(
  run: WritingRunRecord,
  ruleSnapshot: RuleSnapshotRecord,
  candidateCount = 3,
): CandidateRecord[] {
  const round = run.round ?? 1;
  const sourcePatchFeedbackIds = normalizedRulePatches(run)
    .filter((patch) => ruleSnapshot.sourcePatchIds.includes(patch.id))
    .flatMap((patch) => patch.feedbackIds);
  const adjustment = feedbackSummary(run, undefined, sourcePatchFeedbackIds);
  const skillCategory = run.skill.id === "baseline-no-skill" ? "本次文本生产" : run.skill.category;
  const outputContract = outputContractFor(run);
  const seed = `${run.id}:${run.jobSpec.title}:${run.skill.id}:r${round}:${ruleSnapshot.id}:${adjustment.signature}`;
  const baseTitles = [
    round > 1
      ? `${run.jobSpec.title || "本轮主题"}：按反馈收窄判断`
      : `${run.jobSpec.title || "本轮主题"}：先把生产闭环跑起来`,
    round > 1 ? "把局部反馈转成下一轮写法约束" : "先固定输入契约，再比较候选文本",
    round > 1 ? `${skillCategory}第 ${round} 轮候选` : `${skillCategory}不能只靠一次生成判断`,
  ];

  return Array.from({ length: candidateCount }, (_, index) => {
    const title = baseTitles[index] ?? `${skillCategory}第 ${round} 轮扩展候选 ${index + 1}`;
    const quality = clampScore(scoreSeed(`${seed}:quality:${index}`, 24, 5) + (round > 1 ? 1 : 0), 0, 35);
    const fit = clampScore(scoreSeed(`${seed}:fit:${index}`, 27, 6) + (adjustment.hasTaskIssue ? 2 : 0), 0, 35);
    const style = clampScore(scoreSeed(`${seed}:style:${index}`, 20, 5) + (adjustment.hasStyleIssue || adjustment.hasPositive ? 2 : 0), 0, 30);
    const risk = -clampScore(scoreSeed(`${seed}:risk:${index}`, 3, 5) - (adjustment.hasFactIssue ? 1 : 0), 1, 10);
    const total = quality + fit + style + risk;
    const feedbackLine =
      adjustment.count > 0
        ? `本轮已吸收反馈：${adjustment.reasons.join(" / ")}。`
        : "本轮没有新增人工反馈，保留上一轮规则作为对照。";

    return {
      id: `candidate_r${round}_${index + 1}`,
      round,
      runId: `generation_${run.id}_r${round}`,
      generatedByRuleSnapshotId: ruleSnapshot.id,
      version: `Round ${round} · Version ${index + 1}`,
      title,
      summary:
        index === 0
          ? `按 ${outputContract.artifactType} / ${outputContract.lengthRange} 组织主文本。`
          : index === 1
            ? "强调 Job Spec、Output Contract、Precheck、Eval Run 如何降低输入复杂度。"
            : "强调 Skill 只能从多轮评分和反馈里沉淀，不能从单篇文本发布。",
      excerpt:
        index === 0
          ? `这次推进的关键不是新增页面，而是让 ${skillCategory} 的输入、生成、评分和反馈都留下可追溯记录。本候选必须满足 ${outputContract.lengthRange}、${outputContract.structure}。${feedbackLine}`
          : index === 1
            ? `如果输入仍然是原始素材和口头偏好混在一起，后续任何生成质量讨论都会变成一次性手工判断。${feedbackLine}`
            : `参考写法提供的是信号，不是资产。只有经过 Eval Run 和人工反馈校准后，它才可能进入 Skill Candidate。${feedbackLine}`,
      total,
      humanScore: (7.5 + index * 0.3).toFixed(1),
      breakdown: { quality, fit, style, risk },
      rationale:
        round > 1 && adjustment.count > 0
          ? `已按 ${adjustment.count} 条反馈重写候选信号；仍需人工确认偏移是否被修正。`
          : index === 0
          ? "覆盖完整，业务闭环意识强；需要继续观察偏好稳定性。"
          : index === 1
            ? "结构清晰，适合作为短版说明；Skill 生命周期展开不足。"
            : "风险意识强，但对本轮任务目标覆盖偏窄。",
      risk: run.precheckRun.riskChecks
        .map((riskCheck) => `${riskCheck.label}：${riskCheck.level === "medium" ? "中" : "低"}`)
        .join("；"),
      feedbackApplied: adjustment.rules,
    };
  });
}

function buildEvalRun(run: WritingRunRecord, candidates: CandidateRecord[]): EvalRun {
  const round = run.round ?? 1;
  const outputContract = outputContractFor(run);
  return {
    id: `eval_${run.id}_r${round}`,
    round,
    status: "complete",
    profileVersion: `baseline-eval-profile-v0.1-r${round}`,
    riskSummary: run.precheckRun.riskChecks.map((item) => `${item.label}:${item.level}`).join(" / "),
    candidateResults: candidates.map((candidate) => ({
      candidateId: candidate.id,
      total: candidate.total,
      strongestSignal:
        candidate.breakdown.fit >= candidate.breakdown.quality ? "任务匹配" : "基础质量",
      weakestSignal:
        Math.abs(candidate.breakdown.risk) >= 6 ? "风险扣分" : "风格偏好",
      attribution: [
        {
          dimension: "基础质量",
          source: "baseline quality rubric",
          evidence: "段落完整、观点清晰、结论可追问。",
          score: candidate.breakdown.quality,
        },
        {
          dimension: "任务匹配",
          source: "Eval Profile + Content Brief",
          evidence: run.precheckRun.contentBrief,
          score: candidate.breakdown.fit,
        },
        {
          dimension: "格式契约",
          source: "Output Contract",
          evidence: `${outputContract.artifactType} / ${outputContract.lengthRange} / ${outputContract.structure} / ${outputContract.formatRules}`,
          score: candidate.breakdown.fit,
        },
        {
          dimension: "风格偏好",
          source: "Writing Rule Candidate + 评审偏好",
          evidence: run.jobSpec.reviewPreference,
          score: candidate.breakdown.style,
        },
        {
          dimension: "风险扣分",
          source: "Risk Check / grounding / similarity",
          evidence: run.precheckRun.riskChecks.map((item) => item.reason).join(" "),
          score: candidate.breakdown.risk,
        },
      ],
    })),
  };
}

export async function createWritingRun(input: CreateWritingRunInput) {
  const id = shortId("run");
  const createdAt = now();
  const precheckRun = derivePrecheckRun(input, id);
  const ruleSnapshot = initialRuleSnapshot(id, createdAt, precheckRun);
  const run: WritingRunRecord = {
    id,
    createdAt,
    updatedAt: createdAt,
    status: "precheck_ready",
    round: 1,
    storePath: storePathFor(id),
    quickIntake: input.quickIntake,
    skill: input.skill,
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
    skillCandidate: {
      id: `skill_candidate_${input.skill.id}`,
      status: "candidate",
      version: `${input.skill.version}-candidate-r1`,
      iterationCount: 0,
      meanHumanScore: null,
      updateNote: "等待候选评分和人工反馈。",
    },
    trace: [
      trace("job.created", input.quickIntake || input.jobSpec.title, "Job Spec 草稿已写入 run store"),
      trace("output_contract.bound", outputContractFor(input).artifactType, "Output Contract 已绑定为本轮交付契约"),
      trace("precheck.ready", input.jobSpec.source, "Precheck Candidate 已生成"),
    ],
  };

  await persistRun(run);
  return run;
}

export async function readWritingRun(runId: string) {
  const content = await readFile(storePathFor(runId), "utf8");
  return JSON.parse(content) as WritingRunRecord;
}

export async function listWritingRuns() {
  await ensureStore();
  const files = await readdir(STORE_DIR);
  const runs = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => JSON.parse(await readFile(path.join(STORE_DIR, file), "utf8")) as WritingRunRecord),
  );

  return runs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function confirmWritingRunPrecheck(runId: string) {
  const run = await readWritingRun(runId);
  const normalizedRun = { ...run, round: run.round ?? 1 };
  const ruleSnapshots = normalizedRuleSnapshots(normalizedRun);
  const activeRuleSnapshot = ruleSnapshots.at(-1) ?? initialRuleSnapshot(run.id, run.createdAt, run.precheckRun);
  const candidates = generateCandidates(normalizedRun, activeRuleSnapshot);
  const evalRun = buildEvalRun(normalizedRun, candidates);
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
    skillCandidate: {
      ...run.skillCandidate,
      version: skillCandidateVersion(normalizedRun),
    },
    trace: [
      ...run.trace,
      trace("precheck.confirmed", run.precheckRun.id, "Precheck Candidate 被确认为本轮生成契约"),
      trace("candidate.generated", candidates.map((candidate) => candidate.id).join(", "), "候选版本已生成"),
      trace("eval.completed", evalRun.id, "Eval Run 已完成评分归因", "L2"),
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

  const adjustment = feedbackSummary(run, input.candidateId, feedback.map((item) => item.id));
  const draftPatchIndexes = patches
    .map((patch, index) => ({ patch, index }))
    .filter(({ patch }) => patch.status === "draft");
  const patchDraft: RulePatchRecord = {
    id: shortId("rule_patch"),
    at: now(),
    status: "draft",
    sourceCandidateId: input.candidateId,
    feedbackIds: feedback.map((item) => item.id),
    reason: adjustment.reasons.join(" / ") || "no-change",
    rule: adjustment.rules[0] ?? "反馈规则：本次未发现可编译的新反馈，保留现有规则。",
    note:
      feedback.length > 0
        ? `从 ${input.candidateId} 编译 ${feedback.length} 条反馈为规则草稿。`
        : `${input.candidateId} 没有未处理反馈，记录 no-change 规则草稿。`,
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
    skillCandidate: {
      ...run.skillCandidate,
      version: skillCandidateVersion(run),
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
  const nextSkillVersion = `${run.skill.version}-candidate-r${nextRound}`;
  const nextPrecheckRun: PrecheckRun = {
    ...run.precheckRun,
    id: `${run.precheckRun.id}_r${nextRound}`,
    status: "confirmed",
    contentBrief: `${run.precheckRun.contentBrief}。第 ${nextRound} 批：${adjustment.updateNote}`,
    writingRuleCandidate: nextRules,
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
    skillCandidate: {
      ...run.skillCandidate,
      version: nextSkillVersion,
      iterationCount: patches.length,
      updateNote:
        appliedPatches.length > 0
          ? `已应用 ${appliedPatches.length} 条规则草稿，生成第 ${nextRound} 批候选。`
          : `未应用新规则，使用 ${previousSnapshot.version} 生成第 ${nextRound} 批候选。`,
    },
  };
  const candidates = generateCandidates(baseRun, nextRuleSnapshot, input.candidateCount ?? 3);
  const evalRun = buildEvalRun(baseRun, candidates);
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
      trace("eval.completed", evalRun.id, "新一批 Eval Run 已完成评分归因", "L2"),
    ],
  };

  await persistRun(updated);
  return updated;
}

export async function recordHumanFeedback(runId: string, input: HumanFeedbackInput) {
  const run = await readWritingRun(runId);
  const feedback: HumanFeedbackRecord = {
    id: shortId("feedback"),
    at: now(),
    candidateId: input.candidateId,
    kind: input.kind ?? "score",
    score: typeof input.score === "number" ? input.score : null,
    note: input.note ?? "用户在 L1 候选区录入人工反馈。",
    status: "unprocessed",
    quote: input.quote,
    verdict: input.verdict,
    businessReason: input.businessReason,
    likelyCause: input.likelyCause,
    issue: input.issue,
    expected: input.expected,
    confidence: input.confidence,
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
  const updated: WritingRunRecord = {
    ...run,
    updatedAt: now(),
    status: "feedback_recorded",
    feedback: feedbackLedger,
    skillCandidate: {
      ...run.skillCandidate,
      version: skillCandidateVersion(run),
      iterationCount: feedbackLedger.length,
      meanHumanScore: meanHumanScore === null ? null : Number(meanHumanScore.toFixed(2)),
      updateNote,
    },
    trace: [
      ...run.trace,
      trace(
        "feedback.recorded",
        `${feedback.candidateId}:${feedback.kind}:${feedback.businessReason ?? feedback.score ?? "no-score"}`,
        "人工反馈已追加到账本",
      ),
      trace("skill_candidate.updated", run.skillCandidate.id, "Skill Candidate 已按反馈更新", "L2"),
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
    skillCandidate: {
      ...run.skillCandidate,
      version: skillCandidateVersion(run),
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
      trace("skill_candidate.updated", run.skillCandidate.id, "Skill Candidate 已按反馈撤回重新计算", "L2"),
    ],
  };

  await persistRun(updated);
  return updated;
}
