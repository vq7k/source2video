import {
  getLLMApiKey,
  resolveModelForNode,
  type LLMNodeModelKey,
  type LLMRuntimeSettings,
} from "@/lib/llm/settings";
import type {
  AnalyzeFeedbackRequest,
  CandidateDraft,
  CandidateGenerationDraft,
  CompileRulePatchRequest,
  FeedbackAnalysisDraft,
  GenerateCandidatesRequest,
  GeneratePrecheckRequest,
  LLMProvider,
  PrecheckDraft,
  RulePatchDraft,
  RuleScopeDraft,
  RuleScopeDraftItem,
} from "@/lib/llm/types";

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

type RuntimeCallResult = {
  content: string;
  upstreamTraceId?: string;
  model: string;
  requestPayload: {
    provider: LLMRuntimeSettings["provider"];
    endpoint: string;
    body: Record<string, unknown>;
  };
  responsePayload: {
    status: number;
    body: unknown;
    content: string;
  };
};

function trimSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function jsonEndpoint(settings: LLMRuntimeSettings) {
  const baseUrl = trimSlash(settings.baseUrl);
  if (settings.provider === "ollama") {
    return `${baseUrl}/api/chat`;
  }

  return baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl}/chat/completions`;
}

async function callRuntime(
  settings: LLMRuntimeSettings,
  node: LLMNodeModelKey,
  messages: ChatMessage[],
): Promise<RuntimeCallResult> {
  const model = resolveModelForNode(settings, node);

  if (settings.provider === "ollama") {
    const endpoint = jsonEndpoint(settings);
    const body = {
      model,
      messages,
      format: "json",
      stream: false,
    };
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status} ${JSON.stringify(payload)}`);
    }
    const content = payload?.message?.content ?? payload?.response ?? "";

    return {
      content,
      upstreamTraceId: payload?.created_at,
      model,
      requestPayload: {
        provider: settings.provider,
        endpoint,
        body,
      },
      responsePayload: {
        status: response.status,
        body: payload,
        content,
      },
    };
  }

  const apiKey = getLLMApiKey();
  const endpoint = jsonEndpoint(settings);
  const body = {
    model,
    messages,
    temperature: 0.2,
    response_format: { type: "json_object" },
  };
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`OpenAI-compatible request failed: ${response.status} ${JSON.stringify(payload)}`);
  }
  const content = payload?.choices?.[0]?.message?.content ?? "";

  return {
    content,
    upstreamTraceId: payload?.id,
    model,
    requestPayload: {
      provider: settings.provider,
      endpoint,
      body,
    },
    responsePayload: {
      status: response.status,
      body: payload,
      content,
    },
  };
}

function parseJSON(content: string) {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  return JSON.parse(fenced ?? trimmed);
}

function tracedOutput<T>(response: RuntimeCallResult, parsed: unknown, output: T) {
  return {
    ...response.responsePayload,
    parsed,
    normalizedOutput: output,
  };
}

function runtimeError(label: string, error: unknown): never {
  throw new Error(`${label} LLM 调用失败，未生成本地 mock：${error instanceof Error ? error.message : "unknown error"}`);
}

function clampScore(value: unknown) {
  const score = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(score)) {
    return 70;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function clampDimension(value: unknown, fallback: number, min: number, max: number) {
  const score = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(score)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.round(score)));
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function boundedStringValue(value: unknown, fallback: string, max = 12000) {
  const text = stringValue(value, fallback);

  return text.length > max ? text.slice(0, max) : text;
}

function clippedStringValue(value: unknown, fallback: string, max: number) {
  const text = stringValue(value, fallback).replace(/\s+/g, " ");

  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function normalizeItem(value: unknown): RuleScopeDraftItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const kind = record.kind;
  if (kind !== "structure" && kind !== "tone" && kind !== "prohibition" && kind !== "checklist") {
    return null;
  }
  const confidence = record.confidence === "high" || record.confidence === "medium" || record.confidence === "low"
    ? record.confidence
    : "medium";

  return {
    kind,
    text: clippedStringValue(record.text, "模型返回了空规则，请人工确认。", 96),
    sourceNote: clippedStringValue(record.sourceNote, "LLM runtime", 48),
    confidence,
  };
}

function compactScopeItems(items: RuleScopeDraftItem[], hasReference: boolean) {
  const maxItems = hasReference ? 5 : 3;
  const priority: RuleScopeDraftItem["kind"][] = ["structure", "tone", "checklist", "prohibition"];
  const selected: RuleScopeDraftItem[] = [];

  for (const kind of priority) {
    const item = items.find((candidate) => candidate.kind === kind);
    if (item) {
      selected.push(item);
    }
    if (selected.length >= maxItems) {
      return selected;
    }
  }

  for (const item of items) {
    if (!selected.includes(item)) {
      selected.push(item);
    }
    if (selected.length >= maxItems) {
      break;
    }
  }

  return selected;
}

function normalizeDraft(value: unknown, hasReference = true): RuleScopeDraft {
  if (!value || typeof value !== "object") {
    throw new Error("LLM 返回的不是 JSON 对象。");
  }
  const record = value as Record<string, unknown>;
  const source = record.source === "baseline" || record.source === "reference_paste" || record.source === "mixed"
    ? record.source
    : "mixed";
  const items = Array.isArray(record.items)
    ? record.items.map(normalizeItem).filter((item): item is RuleScopeDraftItem => Boolean(item)).slice(0, 8)
    : [];
  if (!items.length) {
    throw new Error("LLM 返回的写作规则范围为空。");
  }
  const scopedItems = compactScopeItems(items, hasReference);
  const evalRecord = record.eval && typeof record.eval === "object" ? record.eval as Record<string, unknown> : {};
  const rawChecks = Array.isArray(evalRecord.checks) ? evalRecord.checks : [];

  return {
    source: hasReference ? source : "baseline",
    warning: hasReference
      ? clippedStringValue(
          record.warning,
          "真实 LLM 生成的 scope 可能误读材料、遗漏约束或过度提炼；确认前不要进入生成。",
          96,
        )
      : "未提供参考文本，本轮只生成 baseline 级 Scope；不会沉淀专属风格或格式约束。",
    items: scopedItems,
    eval: {
      status: "complete",
      score: clampScore(evalRecord.score),
      checks: rawChecks.map((item, index) => {
        const check = item && typeof item === "object" ? item as Record<string, unknown> : {};
        const status: "pass" | "warning" | "blocked" =
          check.status === "pass" || check.status === "warning" || check.status === "blocked"
          ? check.status
          : "warning";

        return {
          label: stringValue(check.label, `runtime check ${index + 1}`),
          status,
          evidence: stringValue(check.evidence, "LLM 返回了检查项，但没有提供依据。"),
          guidance: stringValue(check.guidance, "人工确认是否采纳。"),
        };
      }).slice(0, 4),
    },
  };
}

function riskLevel(value: unknown): "low" | "medium" | "high" {
  return value === "low" || value === "medium" || value === "high" ? value : "medium";
}

function normalizePrecheckDraft(value: unknown): PrecheckDraft {
  if (!value || typeof value !== "object") {
    throw new Error("LLM 返回的生成前检查不是 JSON 对象。");
  }
  const record = value as Record<string, unknown>;
  const ruleValues = Array.isArray(record.writingRulesCandidate) ? record.writingRulesCandidate : [];
  const rules = ruleValues
    .map((item) => stringValue(item, ""))
    .filter(Boolean)
    .slice(0, 10);
  if (!rules.length) {
    throw new Error("LLM 返回的生成前检查规则为空。");
  }
  const rawRisks = Array.isArray(record.riskChecks) ? record.riskChecks : [];
  const risks = rawRisks
    .map((item, index) => {
      const risk = item && typeof item === "object" ? item as Record<string, unknown> : {};
      return {
        label: stringValue(risk.label, `risk ${index + 1}`),
        level: riskLevel(risk.level),
        reason: stringValue(risk.reason, "模型未给出风险理由，请人工确认。"),
      };
    })
    .slice(0, 6);

  return {
    warning: stringValue(
      record.warning,
      "真实 LLM 生成的 Precheck 可能误读输入、遗漏事实边界或生成错误评分前提；确认前不要生成候选。",
    ),
    contentBrief: stringValue(record.contentBrief, "模型未返回 Content Brief，请人工确认。"),
    groundingBrief: stringValue(record.groundingBrief, "模型未返回依据边界，请人工确认。"),
    writingRulesCandidate: rules,
    riskChecks: risks.length
      ? risks
      : [
          {
            label: "LLM 输出缺风险项",
            level: "medium",
            reason: "Precheck JSON 未包含 riskChecks，需人工补充事实、相似表达和交付契约风险。",
          },
        ],
  };
}

function normalizeCandidateDraft(value: unknown, index: number): CandidateDraft | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const text = boundedStringValue(record.excerpt ?? record.fullText ?? record.text, "", 16000);
  if (!text) {
    return null;
  }
  const rawBreakdown = record.breakdown && typeof record.breakdown === "object"
    ? record.breakdown as Record<string, unknown>
    : record.scoreHints && typeof record.scoreHints === "object"
      ? record.scoreHints as Record<string, unknown>
      : {};

  return {
    title: boundedStringValue(record.title, `候选版本 ${index + 1}`, 160),
    summary: boundedStringValue(record.summary, "模型未返回摘要。", 280),
    excerpt: text,
    rationale: boundedStringValue(record.rationale, "模型未返回评分理由。", 600),
    risk: boundedStringValue(record.risk, "模型未返回风险说明。", 600),
    breakdown: {
      quality: clampDimension(rawBreakdown.quality, 26, 0, 35),
      fit: clampDimension(rawBreakdown.fit, 28, 0, 35),
      style: clampDimension(rawBreakdown.style, 22, 0, 30),
      risk: -Math.abs(clampDimension(rawBreakdown.risk, -4, -10, 0)),
    },
  };
}

function normalizeCandidateGeneration(value: unknown): CandidateGenerationDraft {
  if (!value || typeof value !== "object") {
    throw new Error("LLM 返回的候选内容不是 JSON 对象。");
  }
  const record = value as Record<string, unknown>;
  const candidates = Array.isArray(record.candidates)
    ? record.candidates
        .map(normalizeCandidateDraft)
        .filter((item): item is CandidateDraft => Boolean(item))
        .slice(0, 6)
    : [];
  if (!candidates.length) {
    throw new Error("LLM 返回的候选为空。");
  }

  return {
    warning: stringValue(record.warning, "真实 LLM 生成候选可能跑题、事实漂移或过度模仿；必须经过 eval 和人工轻反馈。"),
    candidates,
  };
}

function businessReason(value: unknown): NonNullable<FeedbackAnalysisDraft["businessReason"]> {
  switch (value) {
    case "任务不准":
    case "事实不稳":
    case "风格不对":
    case "偏好不符":
    case "风险过高":
    case "表达冗余":
    case "结构问题":
    case "正向样本":
      return value;
    default:
      return "风格不对";
  }
}

function likelyCause(value: unknown): NonNullable<FeedbackAnalysisDraft["likelyCause"]> {
  switch (value) {
    case "style":
    case "prompt":
    case "schema":
    case "rubric":
    case "exemplar":
    case "single-case":
      return value;
    default:
      return "style";
  }
}

function confidence(value: unknown): NonNullable<FeedbackAnalysisDraft["confidence"]> {
  return value === "low" || value === "medium" || value === "high" ? value : "medium";
}

function normalizeFeedbackAnalysis(value: unknown): FeedbackAnalysisDraft {
  if (!value || typeof value !== "object") {
    throw new Error("LLM 返回的反馈分析不是 JSON 对象。");
  }
  const record = value as Record<string, unknown>;

  return {
    businessReason: businessReason(record.businessReason),
    likelyCause: likelyCause(record.likelyCause),
    issue: boundedStringValue(record.issue, "模型未返回问题归因，请人工确认。", 500),
    expected: boundedStringValue(record.expected, "下一轮减少该类偏移。", 500),
    confidence: confidence(record.confidence),
    note: boundedStringValue(record.note, "反馈已由 LLM 归因。", 500),
  };
}

function normalizeRulePatch(value: unknown): RulePatchDraft {
  if (!value || typeof value !== "object") {
    throw new Error("LLM 返回的规则草稿不是 JSON 对象。");
  }
  const record = value as Record<string, unknown>;
  const rule = boundedStringValue(record.rule, "", 700);
  if (!rule) {
    throw new Error("LLM 返回的规则草稿为空。");
  }

  return {
    reason: boundedStringValue(record.reason, "局部反馈", 160),
    rule,
    note: boundedStringValue(record.note, "规则草稿由真实 LLM 编译。", 500),
  };
}

function scopePrompt(quickIntake: string, referencePaste: string) {
  const hasReference = referencePaste.trim().length > 0;

  return [
    {
      role: "system" as const,
      content:
        "你是 doc-maker 的写作规则范围提炼器。只输出 JSON，不输出 markdown。不要复制参考文本原句，只抽象结构、语气、禁忌、检查点。规则范围是进入输入契约前的轻量边界，不是完整写作方案。",
    },
    {
      role: "user" as const,
      content: JSON.stringify({
        task: "为本次文本生成任务提炼写作规则范围。",
        constraints: {
          maxItems: hasReference ? 5 : 3,
          maxTextLength: hasReference ? 72 : 54,
          maxSourceNoteLength: 32,
          noReferenceBehavior:
            "If referencePaste is empty, only produce baseline generic rules. Do not invent proprietary style, format, author preference, or reusable skill constraints.",
          itemPolicy:
            "Prefer one concise item per kind. Do not split the same idea into multiple structure/tone/prohibition items.",
        },
        outputSchema: {
          source: "baseline | reference_paste | mixed",
          warning: "string",
          items: [
            {
              kind: "structure | tone | prohibition | checklist",
              text: "string",
              sourceNote: "string",
              confidence: "low | medium | high",
            },
          ],
          eval: {
            status: "complete",
            score: "0-100",
            checks: [
              {
                label: "string",
                status: "pass | warning | blocked",
                evidence: "string",
                guidance: "string",
              },
            ],
          },
        },
        quickIntake,
        referencePaste,
      }),
    },
  ];
}

function precheckPrompt(input: GeneratePrecheckRequest) {
  return [
    {
      role: "system" as const,
      content:
        "你是 doc-maker 的生成前检查归一化引擎。只输出 JSON，不输出 markdown。你的任务是把输入契约、输出契约、写作规则范围归一为生成前契约候选；不要生成正文。",
    },
    {
      role: "user" as const,
      content: JSON.stringify({
        task: "把文本生产任务归一为生成前检查候选。",
        outputSchema: {
          warning: "string",
          contentBrief: "string",
          groundingBrief: "string",
          writingRulesCandidate: ["string"],
          riskChecks: [
            {
              label: "string",
              level: "low | medium | high",
              reason: "string",
            },
          ],
        },
        constraints: [
          "Content Brief must describe this round's writing task, audience/purpose, and expected output.",
          "Grounding Brief must state source boundaries and what cannot be invented.",
          "Writing rules must be actionable generation constraints, not generic advice.",
          "Risk checks must cover factual drift, over-imitation, preference drift, and output contract mismatch when applicable.",
          "Do not copy reference text sentences.",
        ],
        input,
      }),
    },
  ];
}

function candidatesPrompt(input: GenerateCandidatesRequest) {
  return [
    {
      role: "system" as const,
      content:
        "你是 doc-maker 的候选生成节点。只输出 JSON，不输出 markdown fence。生成的是可评审正文候选，不生成视觉指导、TTS 改写或下游视频脚本。必须严格遵守输出契约、生成前检查候选和规则快照。",
    },
    {
      role: "user" as const,
      content: JSON.stringify({
        task: "Generate multiple candidate text artifacts for one writing run.",
        outputSchema: {
          warning: "string",
          candidates: [
            {
              title: "string",
              summary: "string",
              excerpt: "full generated text, may be long",
              rationale: "string",
              risk: "string",
              breakdown: {
                quality: "0-35",
                fit: "0-35",
                style: "0-30",
                risk: "-10-0",
              },
            },
          ],
        },
        constraints: [
          `Return exactly ${input.candidateCount} candidates.`,
          "Candidates must be meaningfully different in emphasis, not simple paraphrases.",
          "不要编造输入契约 / 依据边界之外的事实。",
          "Do not copy reference sentences.",
          "Keep visual/TTS/video guidance out of this node.",
          "Use Chinese unless the input explicitly requires another language.",
          "The generated body should follow lengthRange and structure, but do not truncate if the task requires complete text.",
        ],
        input: {
          round: input.round,
          jobSpec: input.jobSpec,
          outputContract: input.outputContract,
          outputProfile: input.outputProfile,
          skillPackage: input.skillPackage,
          precheckRun: input.precheckRun,
          ruleScope: input.ruleScope,
          ruleSnapshot: input.ruleSnapshot,
          recentFeedback: input.feedback.slice(-8),
          activeRulePatches: input.rulePatches.slice(-5),
        },
      }),
    },
  ];
}

function feedbackPrompt(input: AnalyzeFeedbackRequest) {
  return [
    {
      role: "system" as const,
      content:
        "你是 doc-maker 的 Feedback Reasoning 节点。只输出 JSON。根据候选正文、选中文本和用户标签，判断不满意或喜欢的业务原因。不要生成新正文。",
    },
    {
      role: "user" as const,
      content: JSON.stringify({
        task: "Classify human feedback into business reason and likely cause.",
        outputSchema: {
          businessReason: "任务不准 | 事实不稳 | 风格不对 | 偏好不符 | 风险过高 | 表达冗余 | 结构问题 | 正向样本",
          likelyCause: "style | prompt | schema | rubric | exemplar | single-case",
          issue: "string",
          expected: "string",
          confidence: "low | medium | high",
          note: "string",
        },
        input,
      }),
    },
  ];
}

function rulePatchPrompt(input: CompileRulePatchRequest) {
  return [
    {
      role: "system" as const,
      content:
        "你是 doc-maker 的规则草稿编译节点。只输出 JSON。把人工反馈编译为下一轮可执行写作规则。不要改写旧候选，不要把单次偏好过度泛化为长期规则。",
    },
    {
      role: "user" as const,
      content: JSON.stringify({
        task: "Compile feedback into one concise rule patch for next candidate generation.",
        outputSchema: {
          reason: "string",
          rule: "string",
          note: "string",
        },
        constraints: [
          "Rule must be actionable in the next generation run.",
          "Rule must preserve evidence boundary and avoid copying candidate sentences.",
          "If feedback is positive, describe the reusable writing move, not the exact sentence.",
        ],
        input,
      }),
    },
  ];
}

export function createStructuredJSONProvider(settings: LLMRuntimeSettings): LLMProvider {
  return {
    async generateRuleScope({ quickIntake, referencePaste }) {
      const startedAt = Date.now();
      try {
        const response = await callRuntime(settings, "scope_extraction", scopePrompt(quickIntake, referencePaste));
        const parsed = parseJSON(response.content);
        const output = normalizeDraft(parsed, Boolean(referencePaste.trim()));
        return {
          provider: settings.provider,
          model: response.model,
          promptVersion: "rule-scope-extraction-v0.2",
          traceId: response.upstreamTraceId ?? `${settings.provider}_${Date.now().toString(36)}`,
          latencyMs: Date.now() - startedAt,
          requestPayload: response.requestPayload,
          responsePayload: tracedOutput(response, parsed, output),
          output,
        };
      } catch (error) {
        runtimeError("Rule Scope", error);
      }
    },
    async generatePrecheck(input) {
      const startedAt = Date.now();
      try {
        const response = await callRuntime(settings, "precheck_normalization", precheckPrompt(input));
        const parsed = parseJSON(response.content);
        const output = normalizePrecheckDraft(parsed);
        return {
          provider: settings.provider,
          model: response.model,
          promptVersion: "precheck-normalization-v0.2",
          traceId: response.upstreamTraceId ?? `${settings.provider}_${Date.now().toString(36)}`,
          latencyMs: Date.now() - startedAt,
          requestPayload: response.requestPayload,
          responsePayload: tracedOutput(response, parsed, output),
          output,
        };
      } catch (error) {
        runtimeError("Precheck", error);
      }
    },
    async generateCandidates(input) {
      const startedAt = Date.now();
      try {
        const response = await callRuntime(settings, "candidate_generation", candidatesPrompt(input));
        const parsed = parseJSON(response.content);
        const output = normalizeCandidateGeneration(parsed);
        if (output.candidates.length < input.candidateCount) {
          output.warning = `${output.warning}；模型返回 ${output.candidates.length}/${input.candidateCount} 个候选，未使用本地 mock 补齐。`;
        }

        return {
          provider: settings.provider,
          model: response.model,
          promptVersion: "candidate-generation-v0.2",
          traceId: response.upstreamTraceId ?? `${settings.provider}_${Date.now().toString(36)}`,
          latencyMs: Date.now() - startedAt,
          requestPayload: response.requestPayload,
          responsePayload: tracedOutput(response, parsed, output),
          output,
        };
      } catch (error) {
        runtimeError("Candidate generation", error);
      }
    },
    async analyzeFeedback(input) {
      const startedAt = Date.now();
      try {
        const response = await callRuntime(settings, "feedback_reasoning", feedbackPrompt(input));
        const parsed = parseJSON(response.content);
        const output = normalizeFeedbackAnalysis(parsed);
        return {
          provider: settings.provider,
          model: response.model,
          promptVersion: "feedback-reasoning-v0.2",
          traceId: response.upstreamTraceId ?? `${settings.provider}_${Date.now().toString(36)}`,
          latencyMs: Date.now() - startedAt,
          requestPayload: response.requestPayload,
          responsePayload: tracedOutput(response, parsed, output),
          output,
        };
      } catch (error) {
        runtimeError("Feedback reasoning", error);
      }
    },
    async compileRulePatch(input) {
      const startedAt = Date.now();
      try {
        const response = await callRuntime(settings, "rule_patch_compilation", rulePatchPrompt(input));
        const parsed = parseJSON(response.content);
        const output = normalizeRulePatch(parsed);
        return {
          provider: settings.provider,
          model: response.model,
          promptVersion: "rule-patch-compilation-v0.2",
          traceId: response.upstreamTraceId ?? `${settings.provider}_${Date.now().toString(36)}`,
          latencyMs: Date.now() - startedAt,
          requestPayload: response.requestPayload,
          responsePayload: tracedOutput(response, parsed, output),
          output,
        };
      } catch (error) {
        runtimeError("Rule patch", error);
      }
    },
  };
}

export async function testStructuredJSONRuntime(settings: LLMRuntimeSettings) {
  const startedAt = Date.now();
  if (settings.provider === "mock") {
    return {
      ok: true,
      provider: "mock",
      model: settings.model,
      message: "本地模拟运行已就绪",
      latencyMs: 0,
      upstreamTraceId: `mock_test_${Date.now().toString(36)}`,
      requestPayload: {
        provider: "mock" as const,
        endpoint: "local://mock",
        body: { provider: "mock", model: settings.model },
      },
      responsePayload: {
        status: 200,
        body: { ok: true, message: "本地模拟运行已就绪" },
        content: "{\"ok\":true}",
      },
    };
  }

  const response = await callRuntime(settings, "scope_extraction", [
    {
      role: "system",
      content: "Return only JSON.",
    },
    {
      role: "user",
      content: "{\"ok\":true,\"message\":\"runtime test\"}",
    },
  ]);
  parseJSON(response.content);

  return {
    ok: true,
    provider: settings.provider,
    model: response.model,
    message: "runtime test completed",
    latencyMs: Date.now() - startedAt,
    upstreamTraceId: response.upstreamTraceId,
    requestPayload: response.requestPayload,
    responsePayload: response.responsePayload,
  };
}
