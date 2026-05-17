import type {
  AnalyzeFeedbackRequest,
  CandidateDraft,
  CompileRulePatchRequest,
  GenerateCandidatesRequest,
  GeneratePrecheckRequest,
  LLMProvider,
  RulePatchDraft,
  FeedbackAnalysisDraft,
  PrecheckDraft,
  RuleScopeDraft,
  RuleScopeDraftItem,
} from "@/lib/llm/types";

function hasAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function compact(text: string, fallback: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return fallback;
  }

  return normalized.length > 72 ? `${normalized.slice(0, 72)}...` : normalized;
}

function sourceFor(referencePaste: string, fallback: string) {
  return referencePaste.trim() ? `Reference Paste：${compact(referencePaste, fallback)}` : fallback;
}

function buildItems(quickIntake: string, referencePaste: string): RuleScopeDraftItem[] {
  const combined = `${quickIntake}\n${referencePaste}`;
  const hasReference = referencePaste.trim().length > 0;
  const items: RuleScopeDraftItem[] = [
    {
      kind: "structure",
      text: hasAny(combined, ["先", "再", "最后", "结构", "递进"])
        ? "按参考材料的论证顺序提炼：先给判断，再给证据，最后给下一步。"
        : "使用 baseline 结构：判断开场、两到三个证据段、明确下一步。",
      sourceNote: sourceFor(referencePaste, "baseline structure"),
      confidence: referencePaste.trim() ? "medium" : "low",
    },
    {
      kind: "tone",
      text: hasAny(combined, ["克制", "理性", "不要夸张", "少口号", "专业"])
        ? "语气保持克制、理性、可追问，避免营销腔和口号化表达。"
        : "默认语气为清晰、低修辞、工作汇报式表达。",
      sourceNote: sourceFor(referencePaste, "baseline tone"),
      confidence: referencePaste.trim() ? "medium" : "low",
    },
    {
      kind: "prohibition",
      text: hasAny(combined, ["不要", "不能", "禁止", "避免", "不编造"])
        ? "禁止复制参考原句、禁止补写未知事实，低置信内容必须标注待确认。"
        : "禁止把参考写法当事实来源，禁止把低置信推断写成确定结论。",
      sourceNote: sourceFor(referencePaste, "baseline risk policy"),
      confidence: referencePaste.trim() ? "medium" : "low",
    },
    {
      kind: "checklist",
      text: "生成前检查：任务是否明确、事实是否可追溯、长度和结构是否符合 Output Contract、风险是否显式暴露。",
      sourceNote: "baseline eval-driven writing checklist",
      confidence: "high",
    },
  ];

  if (hasAny(combined, ["视频", "口播", "短视频", "TTS"])) {
    items.push({
      kind: "checklist",
      text: "短视频文本只输出主文本，不在本节点生成视觉指导或 TTS 专项改写。",
      sourceNote: "Quick Intake downstream signal",
      confidence: "medium",
    });
  }

  return hasReference ? items.slice(0, 5) : items.filter((item) => item.kind !== "prohibition").slice(0, 3);
}

function buildEval(referencePaste: string, items: RuleScopeDraftItem[]): RuleScopeDraft["eval"] {
  const hasReference = referencePaste.trim().length > 0;
  const lowConfidenceCount = items.filter((item) => item.confidence === "low").length;
  const score = hasReference ? 84 - lowConfidenceCount * 4 : 72;

  return {
    status: "complete",
    score,
    checks: [
      {
        label: "source coverage",
        status: hasReference ? "pass" : "warning",
        evidence: hasReference ? "已从 Reference Paste 抽取结构/语气/禁忌信号。" : "未提供参考片段，只能使用 baseline scope。",
        guidance: hasReference ? "保留 source note，确认是否过度提炼。" : "如需模仿专业作者写法，粘贴一小段参考文本。",
      },
      {
        label: "over-imitation guard",
        status: "pass",
        evidence: "Scope 只保留抽象写法，不保存可复制句式。",
        guidance: "后续候选仍需检查相似表达风险。",
      },
      {
        label: "unsupported rule",
        status: lowConfidenceCount > 1 ? "warning" : "pass",
        evidence: `${lowConfidenceCount} 条规则为 low confidence。`,
        guidance: "低置信规则只能作为候选，不应发布为 Skill Package。",
      },
    ],
  };
}

function scopeKindLabel(kind: GeneratePrecheckRequest["ruleScope"]["items"][number]["kind"]) {
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

function buildPrecheckDraft(input: GeneratePrecheckRequest): PrecheckDraft {
  const { jobSpec, outputContract, outputProfile, ruleScope } = input;
  const scopeRules = ruleScope.items.map(
    (item) => `${scopeKindLabel(item.kind)}：${item.text}（来源：${item.sourceNote}；置信度：${item.confidence}）`,
  );
  const hasMissingSignal = jobSpec.source.includes("缺少") || jobSpec.source.includes("不足");
  const hasUnstablePreference = jobSpec.reviewPreference.includes("不稳定");
  const hasStyleReference = jobSpec.writingReference.trim().length > 0;
  const hasReferencePaste = (input.referencePaste?.trim().length ?? 0) > 0;
  const hasSpecialHandling =
    outputContract.specialHandling.trim().length > 0 ||
    outputContract.downstreamHandoff.includes("TTS") ||
    outputContract.downstreamHandoff.includes("Video");

  return {
    warning:
      "Precheck 是按 baseline schema 的候选归一结果；真实生成前仍需人工确认是否误读目标、事实或偏好。",
    contentBrief: `任务：${jobSpec.title}。目标：${jobSpec.goal}`,
    groundingBrief: `底稿边界：${jobSpec.source || "未提供底稿"}。交付契约：${outputContract.artifactType} / ${outputContract.lengthRange} / ${outputContract.structure}。Handoff：${outputContract.downstreamHandoff || outputProfile.name}。`,
    writingRulesCandidate: [
      `产物：${outputContract.artifactType}；长度：${outputContract.lengthRange}；格式：${outputContract.formatRules}`,
      `依据：${outputContract.groundingRules}`,
      `结构：${input.skillPackage.category} 默认先给判断，再给证据，最后给下一步。`,
      ...scopeRules,
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
        level: hasStyleReference || hasReferencePaste ? "medium" : "low",
        reason:
          hasStyleReference || hasReferencePaste
            ? "有写法参考或 Reference Paste，只允许迁移结构，不允许复制句式。"
            : "没有外部参考，仿写风险较低。",
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

function feedbackReasons(input: GenerateCandidatesRequest) {
  const values = input.feedback
    .map((item) => item.businessReason ?? item.verdict ?? item.issue)
    .filter(Boolean);

  return Array.from(new Set(values)).slice(0, 4).join(" / ") || "暂无新增反馈";
}

function buildCandidateDrafts(input: GenerateCandidatesRequest): CandidateDraft[] {
  const rules = input.ruleSnapshot.rules.slice(0, 5);
  const riskSummary = input.precheckRun.riskChecks.map((item) => `${item.label}:${item.level}`).join("；");
  const feedbackLine = feedbackReasons(input);

  return Array.from({ length: input.candidateCount }, (_, index) => ({
    title:
      index === 0
        ? `${input.jobSpec.title || "本轮主题"}：先给结论`
        : index === 1
          ? `${input.jobSpec.title || "本轮主题"}：按证据展开`
          : `${input.jobSpec.title || "本轮主题"}：压缩成短视频口播`,
    summary:
      index === 0
        ? "按已确认 Precheck 生成的主候选，优先满足任务和格式契约。"
        : index === 1
          ? "更强调证据边界和风险提示，适合作为保守版本。"
          : "更强调短句和节奏，适合作为口播初稿。",
    excerpt: [
      `【${input.jobSpec.title || "本轮主题"}】`,
      `这轮要解决的问题不是多生成几段文字，而是把输入、规则、评分和反馈放进同一个可追溯闭环。${input.precheckRun.contentBrief}`,
      `生成时我会遵守三个边界：第一，${input.outputContract.lengthRange}；第二，${input.outputContract.structure}；第三，关键判断必须回到输入或底稿，不能把参考写法当作事实来源。`,
      `本版采用的规则包括：${rules.join("；")}。这些规则仍是本轮候选，不会直接发布成长期资产。`,
      `如果人工反馈指出“${feedbackLine}”，下一轮只更新规则快照并生成新批次，旧候选保持冻结，方便回看偏移是从哪一轮开始的。`,
      `风险提示：${riskSummary || "暂无显式风险项"}。下一步应先读正文并选中不满意或喜欢的片段，系统再把局部反馈编译成下一轮规则草稿。`,
    ].join("\n\n"),
    rationale: "fallback 候选由 deterministic provider 生成，只用于真实 LLM 失败时保证流程不断。",
    risk: riskSummary || "未检测到显式风险项。",
  }));
}

function buildFeedbackAnalysis(input: AnalyzeFeedbackRequest): FeedbackAnalysisDraft {
  const verdict = input.feedback.verdict;
  const quote = input.feedback.quote ?? "";
  const liked = verdict === "liked" || verdict === "accepted";
  const businessReason = liked
    ? "正向样本"
    : quote.includes("事实") || quote.includes("证据")
      ? "事实不稳"
      : quote.includes("结构") || quote.includes("顺序")
        ? "结构问题"
        : "风格不对";

  return {
    businessReason,
    likelyCause: liked ? "exemplar" : businessReason === "事实不稳" ? "rubric" : "style",
    issue: liked ? "该片段可作为正向写法信号。" : input.feedback.issue ?? "局部表达与本轮偏好不一致。",
    expected: liked ? "下一轮复用论证动作，不复制原句。" : input.feedback.expected ?? "减少抽象表达，补足判断和证据关系。",
    confidence: input.feedback.confidence ?? "medium",
    note: `反馈归因：${businessReason}。`,
  };
}

function buildRulePatch(input: CompileRulePatchRequest): RulePatchDraft {
  const reason = Array.from(new Set(input.feedback.map((item) => item.businessReason ?? "局部反馈"))).join(" / ");

  return {
    reason: reason || "局部反馈",
    rule: `反馈规则：下一轮优先处理 ${reason || "已标注问题"}，只迁移可验证的写法动作，不复制旧候选句子。`,
    note: `从 ${input.feedback.length} 条反馈编译为规则草稿；fallback 编译只用于真实 LLM 失败兜底。`,
  };
}

export const mockLLMProvider: LLMProvider = {
  async generateRuleScope({ quickIntake, referencePaste }) {
    const items = buildItems(quickIntake, referencePaste);
    const source = referencePaste.trim() ? "mixed" : "baseline";

    return {
      provider: "mock",
      model: "mock-llm/rule-scope-v0",
      promptVersion: "rule-scope-extraction-v0.1",
      traceId: `mock_scope_${Date.now().toString(36)}`,
      latencyMs: 0,
      output: {
        source,
        items,
        eval: buildEval(referencePaste, items),
        warning:
          "LLM 只能把参考片段压缩成候选规则，不能保证理解正确；用户必须删除不适用或低置信的 scope 项。",
      },
    };
  },
  async generatePrecheck(input) {
    return {
      provider: "mock",
      model: "mock-llm/precheck-normalizer-v0",
      promptVersion: "precheck-normalization-v0.1",
      traceId: `mock_precheck_${Date.now().toString(36)}`,
      latencyMs: 0,
      output: buildPrecheckDraft(input),
    };
  },
  async generateCandidates(input) {
    return {
      provider: "mock",
      model: "mock-llm/candidate-generator-v0",
      promptVersion: "candidate-generation-v0.1",
      traceId: `mock_candidate_${Date.now().toString(36)}`,
      latencyMs: 0,
      output: {
        warning: "候选生成已回退 deterministic provider；只用于保持流程不断。",
        candidates: buildCandidateDrafts(input),
      },
    };
  },
  async analyzeFeedback(input) {
    return {
      provider: "mock",
      model: "mock-llm/feedback-reasoning-v0",
      promptVersion: "feedback-reasoning-v0.1",
      traceId: `mock_feedback_${Date.now().toString(36)}`,
      latencyMs: 0,
      output: buildFeedbackAnalysis(input),
    };
  },
  async compileRulePatch(input) {
    return {
      provider: "mock",
      model: "mock-llm/rule-patch-compiler-v0",
      promptVersion: "rule-patch-compilation-v0.1",
      traceId: `mock_rule_patch_${Date.now().toString(36)}`,
      latencyMs: 0,
      output: buildRulePatch(input),
    };
  },
};
