import type {
  Episode,
  NodeInfo,
  ToyArtifact,
  PlanArtifact,
  ShotArtifact,
  QaArtifact,
  Feedback,
} from "./types";

// ============================================================================
// L1 Episodes（4 个：done / warn / running / failed）
// ============================================================================

export const episodes: Episode[] = [
  {
    id: "ml_lr_e04b",
    title: "线性回归 · 向量与矩阵",
    status: "done",
    source: "03线性回归.pptx",
    size: "2.4MB",
    rounds: 3,
    duration: "10:24",
    artifacts: {
      scripts: "scripts.md",
      shots: "shots/",
      qa_report: "qa_report.md",
    },
  },
  {
    id: "ml_knn_e02a",
    title: "KNN 算法基础",
    status: "warn",
    source: "02KNN算法.pptx",
    size: "1.8MB",
    rounds: 5,
    duration: "12:01",
    qa_warnings: 2,
    user_message: "时长对齐有 2 处偏差，建议在 QA 控制台审阅后接受或重跑。",
    technical_detail: "QA 报告：duration_align FAIL ×2（shot_03 / shot_05 时长偏离 plan 预期超 25%）",
    warn_summary: "QA 报告：duration_align FAIL ×2（shot_03 / shot_05 时长偏离 plan 预期超 25%）",
    warn_node: "qa",
    warn_artifact_id: "ml_knn_e02a_qa_run_2026-05-13_b1d4e5",
  },
  {
    id: "ml_lr_e04c",
    title: "线性回归 · 多元拓展",
    status: "running",
    source: "03线性回归_多元.pptx",
    size: "2.7MB",
    progress: {
      plan: "done",
      shot: { current: 3, total: 6 },
      qa: "pending",
      done: "pending",
    },
    eta: "4:12",
  },
  {
    id: "ml_dt_e05",
    title: "决策树",
    status: "failed",
    source: "05决策树.pptx",
    size: "3.1MB",
    user_message: "系统未能自动拆分讲解节奏（已尝试 3 次调整后放弃）。建议改用人工 plan 或换章节素材。",
    technical_detail: "Plan 节点撞 Bounded Budget（L3 schema 改动 3 次仍 fail）。executability 维度未通过。",
    error: "Plan 节点撞 Bounded Budget（L3 schema 改动 3 次仍 fail）。executability 维度未通过。",
    failed_node: "plan",
    failed_artifact_id: "ml_dt_e05_plan_run_2026-05-13_c8e1a2",
    trace_id: "lf_trace_4f8a72c1",
  },
];

// ============================================================================
// L2 Hub Nodes（4 个）
// ============================================================================

export const nodes: NodeInfo[] = [
  {
    name: "toy",
    label: "ToyNode",
    alive: true,
    latest_artifact: "01_basic_run_2026-05-12_a3f2c1",
    materials_version: "v1.0",
    pass_rate_7d: "5/7 (71%)",
    description: "框架 MVP 用的最小节点；从一段 markdown 抽 3 个要点。",
  },
  {
    name: "plan",
    label: "Plan",
    alive: true,
    latest_artifact: "ml_lr_e04b_plan_run_2026-05-13_b1d4e5",
    materials_version: "v1.2",
    pass_rate_7d: "8/11 (73%)",
    description: "期级 Plan：4 步链 + Evaluator-Optimizer，产 shot list + 叙事弧。",
  },
  {
    name: "shot",
    label: "ShotExecutionNode",
    alive: true,
    latest_artifact: "ml_lr_e04b_shot_03_run_2026-05-13_d2c9f7",
    materials_version: "v1.0",
    pass_rate_7d: "37/48 (77%)",
    description: "节点内 3 步链（text → text_tts ∥ notes），产 shot 三件套。",
  },
  {
    name: "qa",
    label: "Episode QA",
    alive: false,
    latest_artifact: "ml_knn_e02a_qa_run_2026-05-13_b1d4e5",
    materials_version: "v1.0",
    pass_rate_7d: "6/9 (67%)",
    description: "期级一致性 + 时长对齐 + 风格 drift + 衔接（演示离线状态）。",
  },
];

// ============================================================================
// L3 · ToyNode Artifact
// ============================================================================

const toyFeedback: Feedback[] = [
  {
    feedback_id: "fb_2026_05_12_001",
    artifact_id: "01_basic_run_2026-05-12_a3f2c1",
    location: "points[2]",
    verdict: "bad",
    likely_cause: "schema",
    severity: "medium",
    issue: "schema 没强制半角符号，全角逗号混入",
    expected: "schema 加 regex 验证或预处理 normalize",
    reviewer: "xuelin",
    created_at: "2026-05-12 14:31",
  },
  {
    feedback_id: "fb_2026_05_11_007",
    artifact_id: "01_basic_run_2026-05-11_94b8e3",
    location: "points[1]",
    verdict: "minor_nit",
    likely_cause: "style",
    severity: "low",
    issue: "措辞偏书面，缺口语感",
    reviewer: "xuelin",
    created_at: "2026-05-11 22:08",
  },
];

export const toyArtifact: ToyArtifact = {
  artifact_id: "01_basic_run_2026-05-12_a3f2c1",
  node_name: "toy",
  node_version: "v1.0",
  case_id: "cases/train/01_basic.md",
  timestamp: "2026-05-12 14:23:01",
  materials: [
    { kind: "prompts", name: "toy/extract", version: "v1.0", tag: "business_policy", preview: "version: 1.0\ntag: business_policy\ntemplate: |\n  你将读一段说明文字。请抽 3 个要点。" },
    { kind: "rubrics", name: "toy", version: "v1.0", preview: "dimensions:\n  - clarity\n  - coverage\n  - format" },
    { kind: "schemas", name: "toy_artifact", version: "v1.0", preview: "class ToyArtifact(BaseModel):\n    points: list[str]" },
    { kind: "style_guides", name: "toy_voice", version: "v1.0", preview: "L1: 简体中文\nL2: 半角标点\nL8: 不出现 emoji" },
    { kind: "exemplars", name: "ex_01", version: "—" },
    { kind: "exemplars", name: "ex_02", version: "—" },
  ],
  token_used: 1247,
  latency_s: 3.4,
  cost_usd: 0.003,
  content: {
    points: [
      "合成饮料的核心是低成本可控原料",
      "主要成分为水(80%)、糖(10%)、香精+色素",
      "制作流程：过滤 → 配料 → 搅拌 → 冷藏",
    ],
  },
  decision_trace: {
    prompt_template_id: "prompts/toy/extract@v1.0",
    rendered_prompt_diff: "+ case content 注入 ({{content}} → 278 chars)\n+ style 注入 (style_guide#L1-L8 → 132 chars)",
    materials_injected: {
      style_guide: "toy_voice@v1.0#L1-L8",
      schema_hint: "toy_artifact@v1.0#points_field",
    },
    exemplars_used: [
      { id: "ex_01", reason: "few-shot similarity match (短文本 → 3 要点)", similarity: 0.72 },
    ],
    llm_thinking_summary:
      "I focused on three main aspects: cost-control, composition ratios, and process steps. Skipped the marketing tone in the source because style_guide#L4 forbids promotional language.",
  },
  eval: [
    {
      dimension: "clarity",
      verdict: "pass",
      attribution: {
        violated_anchor: "rubrics/toy@v1.0#clarity_anchor_1",
        judge_thinking: "三个要点表述清晰，无歧义。每条都符合 anchor 中 '一句话能复述' 的 pass 标准。",
      },
    },
    {
      dimension: "coverage",
      verdict: "pass",
      attribution: {
        violated_anchor: "rubrics/toy@v1.0#coverage_anchor_2",
        judge_thinking: "覆盖原文 80%+ 主要内容（成分 / 流程 / 成本立场都点到）。",
      },
    },
    {
      dimension: "format",
      verdict: "fail",
      attribution: {
        violated_rule_ref: "schemas/toy_artifact@v1.0#format_rule_3",
        violated_anchor: "rubrics/toy@v1.0#format_anchor_fail",
        citation_in_artifact: "points[2]:\"水(80%)、糖(10%)、香精+色素\"",
        judge_thinking: "points[2] 含全角逗号（、），schema 要求 半角逗号 (,)。违反 schema format_rule_3。",
      },
    },
  ],
  feedback_history: toyFeedback,
  metrics: {
    pass_rate: "5/7 (71%)",
    avg_tokens: "1.2K",
    budget_state: "L0, 1/3 rounds",
    avg_latency: "3.4s",
    feedback_queue: "0 触发中",
    avg_cost: "$0.004",
  },
};

// ============================================================================
// L3 · Plan Artifact（线性回归 · 向量与矩阵）
// ============================================================================

const planShots: PlanArtifact["shots"] = [
  {
    shot_id: "shot_01",
    intent: "hook",
    scope: "用一道实际题目（预测房价）建立 '用特征预测数值' 的直觉。",
    target_duration_seconds: 60,
    incoming_context: null,
    outgoing_state: "观众理解'用特征预测数值'",
    key_concepts: ["特征", "预测", "数值输出"],
    callbacks: [],
    visual_hint: "散点图逐步引入",
  },
  {
    shot_id: "shot_02",
    intent: "setup",
    scope: "从房价例子抽出 y = wx + b 一元线性模型。",
    target_duration_seconds: 90,
    incoming_context: "shot_01 的房价例子",
    outgoing_state: "观众理解线性模型数学表达",
    key_concepts: ["线性模型", "参数 w / b"],
    callbacks: [{ to: "shot_01", type: "concrete_to_abstract" }],
    visual_hint: "拟合直线动画",
  },
  {
    shot_id: "shot_03",
    intent: "extend",
    scope: "从一元拓展到多元：把多个特征装进向量，引入 x = (x1, x2, ..., xn)。",
    target_duration_seconds: 110,
    incoming_context: "shot_02 的一元线性模型",
    outgoing_state: "观众理解向量是装多特征的容器",
    key_concepts: ["向量", "特征拼接"],
    callbacks: [{ to: "shot_02", type: "1d_to_nd" }],
    visual_hint: "1D 散点扩展到 nD 表格",
  },
  {
    shot_id: "shot_04",
    intent: "formalize",
    scope: "把 N 个样本堆成矩阵 X，引入 y = Xw 的紧凑表达。",
    target_duration_seconds: 130,
    incoming_context: "shot_03 的向量",
    outgoing_state: "观众理解矩阵是装多样本×多特征的容器",
    key_concepts: ["矩阵", "行 = 样本", "列 = 特征"],
    callbacks: [{ to: "shot_03", type: "stack_samples" }],
    visual_hint: "向量堆叠成矩阵动画",
  },
  {
    shot_id: "shot_05",
    intent: "payoff",
    scope: "代码 demo：numpy 一行 (X @ w) 完成上千样本预测。",
    target_duration_seconds: 110,
    incoming_context: "shot_04 的 y = Xw",
    outgoing_state: "观众看见矩阵运算的工程价值",
    key_concepts: ["numpy", "向量化计算", "性能对比"],
    callbacks: [{ to: "shot_04", type: "math_to_code" }],
    visual_hint: "代码片段 + 性能 timer",
  },
  {
    shot_id: "shot_06",
    intent: "close",
    scope: "总结 + 引出下期（损失函数与梯度）。",
    target_duration_seconds: 110,
    incoming_context: "shot_05 的 demo",
    outgoing_state: "观众有完整向量化心智 + 期待下一步",
    key_concepts: ["回顾", "下期 hook"],
    callbacks: [{ to: "shot_01", type: "loop_close" }],
    visual_hint: "回顾卡 + 下期预告",
  },
];

export const planArtifact: PlanArtifact = {
  artifact_id: "ml_lr_e04b_plan_run_2026-05-13_b1d4e5",
  node_name: "plan",
  node_version: "v1.2",
  case_id: "cases/synthetic/ml_lr_e04b_source",
  timestamp: "2026-05-13 09:12:44",
  episode_id: "ml_lr_e04b",
  title: "线性回归 · 向量与矩阵",
  target_duration_seconds: 600,
  narrative_arc: "直观例子 → 形式化 → 对比 → 应用边界",
  shots: planShots,
  revision_count: 1,
  materials: [
    { kind: "prompts", name: "plan/step1_digest", version: "v1.3", tag: "business_policy" },
    { kind: "prompts", name: "plan/step2_arc", version: "v1.2", tag: "business_policy" },
    { kind: "prompts", name: "plan/step3_split", version: "v1.4", tag: "business_policy" },
    { kind: "prompts", name: "plan/step4_judge", version: "v1.1", tag: "business_policy" },
    { kind: "rubrics", name: "plan", version: "v1.1" },
    { kind: "schemas", name: "plan_artifact", version: "v1.0" },
    { kind: "style_guides", name: "ml_course", version: "v1.2" },
    { kind: "exemplars", name: "ex_lr_chap_baseline", version: "—" },
  ],
  token_used: 18420,
  latency_s: 47.2,
  cost_usd: 0.31,
  decision_trace: {
    prompt_template_id: "prompts/plan/step3_split@v1.4",
    rendered_prompt_diff:
      "+ step1 concepts (12 个) 注入\n+ step2 arc (hook→setup→extend→formalize→payoff→close) 注入\n+ style ml_course@v1.2#L1-L40 注入 (1.2K chars)",
    materials_injected: {
      style_guide: "ml_course@v1.2#L1-L40",
      terminology: "ml_course/term@v1.1",
      arc_schema: "plan_artifact@v1.0#arc_field",
    },
    exemplars_used: [
      { id: "ex_lr_chap_baseline", reason: "同一章节风格基线", similarity: 0.81 },
    ],
    llm_thinking_summary:
      "考虑到 target=600s 切 6 个 shot 比较合适。Hook 用房价（学过 KNN 已经熟悉的场景），从 1D 推到 nD 而不是直接上 nD，节奏才稳。Step 4 judge 第 1 轮在 duration_alignment 给了 0.78，调整 shot_03 时长 +20s 再过。",
  },
  cross_step_eval: [
    {
      dimension: "coverage",
      verdict: "pass",
      attribution: { violated_anchor: "rubrics/plan@v1.1#coverage_anchor_2", judge_thinking: "原料 12 个核心概念全进 plan。" },
    },
    {
      dimension: "cohesion",
      verdict: "pass",
      attribution: { violated_anchor: "rubrics/plan@v1.1#cohesion_anchor_1", judge_thinking: "6 个 shot scope 互不重叠。" },
    },
    {
      dimension: "arc_completeness",
      verdict: "pass",
      attribution: { violated_anchor: "rubrics/plan@v1.1#arc_anchor_2", judge_thinking: "hook → payoff → close 齐全，节奏合理。" },
    },
    {
      dimension: "duration_alignment",
      verdict: "pass",
      attribution: { violated_anchor: "rubrics/plan@v1.1#duration_anchor_pass", judge_thinking: "总和 610s，目标 600s，偏差 1.7%。" },
    },
    {
      dimension: "executability",
      verdict: "pass",
      attribution: { violated_anchor: "rubrics/plan@v1.1#exec_anchor_2", judge_thinking: "每个 shot 都含 intent / scope / outgoing / visual_hint，下游可独立执行。" },
    },
    {
      dimension: "style_fidelity",
      verdict: "pass",
      attribution: { violated_anchor: "rubrics/plan@v1.1#style_anchor_2", judge_thinking: "ml_course 术语都进 plan。" },
    },
  ],
  eval: [],
  feedback_history: [],
  metrics: {
    pass_rate: "8/11 (73%)",
    avg_tokens: "18.4K",
    budget_state: "L0, 0/3 rounds",
    avg_latency: "47.2s",
    feedback_queue: "1 待 triage",
    avg_cost: "$0.31",
  },
};

// ============================================================================
// L3 · Shot Artifacts（shot_01 ~ shot_06，给 [id] 路由）
// ============================================================================

const shotArtifactBase = (
  shotId: string,
  text: string,
  textTts: string,
  notes: ShotArtifact["notes"],
  passConsistency: "pass" | "fail" = "pass",
): ShotArtifact => ({
  artifact_id: `ml_lr_e04b_${shotId}_run_2026-05-13_d2c9f7`,
  node_name: "shot",
  node_version: "v1.0",
  case_id: `cases/synthetic/ml_lr_e04b/${shotId}`,
  timestamp: "2026-05-13 09:51:12",
  episode_id: "ml_lr_e04b",
  shot_id: shotId,
  plan_artifact_id: "ml_lr_e04b_plan_run_2026-05-13_b1d4e5",
  prev_shot_outgoing:
    shotId === "shot_01"
      ? null
      : planShots[parseInt(shotId.split("_")[1], 10) - 2]?.outgoing_state ?? null,
  materials: [
    { kind: "prompts", name: "shot/step1_text", version: "v1.0", tag: "business_policy" },
    { kind: "prompts", name: "shot/step2_tts", version: "v1.0", tag: "channel_constraint" },
    { kind: "prompts", name: "shot/step3_notes", version: "v1.0", tag: "business_policy" },
    { kind: "rubrics", name: "shot/text", version: "v1.0" },
    { kind: "rubrics", name: "shot/tts", version: "v1.0" },
    { kind: "rubrics", name: "shot/notes", version: "v1.0" },
    { kind: "style_guides", name: "ml_course", version: "v1.2" },
  ],
  token_used: 3210,
  latency_s: 8.1,
  cost_usd: 0.04,
  text,
  text_tts: textTts,
  notes,
  cross_step_consistency: passConsistency,
  decision_trace: {
    prompt_template_id: "prompts/shot/step1_text@v1.0",
    rendered_prompt_diff: `+ plan_slice 注入 (shot_id=${shotId}, intent + scope + outgoing_state)\n+ prev_shot_outgoing 注入 (上下文锚)\n+ style ml_course@v1.2#L1-L40`,
    materials_injected: {
      plan_slice: `ml_lr_e04b_plan@v1.0#${shotId}`,
      style_guide: "ml_course@v1.2#L1-L40",
      terminology: "ml_course/term@v1.1",
    },
    exemplars_used: [],
    llm_thinking_summary: `按 plan_slice 的 intent + outgoing_state 拉一段 ~${planShots.find((s) => s.shot_id === shotId)?.target_duration_seconds}s 的 text。Step 2/3 并行各自基于 step 1 产出 TTS 友好版本 + 视频指导。`,
  },
  eval: [
    {
      dimension: "scope_coverage",
      verdict: "pass",
      attribution: { violated_anchor: "rubrics/shot/text@v1.0#scope_anchor_2", judge_thinking: "scope 完全落地，关键概念都覆盖。" },
    },
    {
      dimension: "tts_pronunciation",
      verdict: "pass",
      attribution: { violated_anchor: "rubrics/shot/tts@v1.0#numeric_anchor_2", judge_thinking: "数字均按中文读法展开（'80%' → '百分之八十'），停顿标记合规。" },
    },
    {
      dimension: "notes_executability",
      verdict: "pass",
      attribution: { violated_anchor: "rubrics/shot/notes@v1.0#exec_anchor_2", judge_thinking: "镜头 cue 与 text 段落对应，demo 引用文件存在。" },
    },
    {
      dimension: "cross_step_consistency",
      verdict: passConsistency,
      attribution: {
        violated_anchor: passConsistency === "pass" ? "rubrics/shot/_node_level@v1.0#consistency_anchor_pass" : "rubrics/shot/_node_level@v1.0#consistency_anchor_fail",
        citation_in_artifact: passConsistency === "fail" ? "text_tts:L3 vs text:L3" : undefined,
        judge_thinking:
          passConsistency === "pass"
            ? "text / text_tts 内容一致；notes 镜头节奏匹配 text 段落。"
            : "text_tts:L3 多了一句过渡句 '我们来看个例子'，text:L3 没这句，三件套不一致。",
      },
    },
  ],
  feedback_history: [],
  metrics: {
    pass_rate: "37/48 (77%)",
    avg_tokens: "3.0K",
    budget_state: "L0, 0/3 rounds",
    avg_latency: "8.1s",
    feedback_queue: "0 触发中",
    avg_cost: "$0.04",
  },
});

export const shotArtifacts: Record<string, ShotArtifact> = {
  shot_01: shotArtifactBase(
    "shot_01",
    "想象你要预测一套房子值多少钱。你大概会看面积、楼层、是不是学区。这些就是 '特征'。给定特征，预测一个数值——这就是回归。",
    "想象你要预测一套房子值多少钱。（停顿 0.3 秒）你大概会看面积、楼层、是不是学区。这些就是 '特征'。（停顿 0.5 秒）给定特征，预测一个数值——这就是回归。",
    [
      { kind: "animation", duration: "10s", visual: "散点图：x = 面积，y = 价格", cues: ["text 第 1-2 句"] },
      { kind: "text_overlay", duration: "8s", visual: "高亮 '特征' 与 '回归' 两个术语", cues: ["text 第 3 句"] },
    ],
  ),
  shot_02: shotArtifactBase(
    "shot_02",
    "把这个想法写成数学就是 y = wx + b。其中 x 是特征，y 是预测值，w 控制斜率，b 控制起点。这就叫一元线性模型。",
    "把这个想法写成数学就是：y 等于 w 乘 x 加 b。（停顿 0.4 秒）其中，x 是特征，y 是预测值，w 控制斜率，b 控制起点。（停顿 0.3 秒）这就叫一元线性模型。",
    [
      { kind: "math_overlay", duration: "12s", visual: "y = wx + b，逐项高亮", cues: ["text 第 1 句"] },
      { kind: "animation", duration: "15s", visual: "拖动 w / b 滑块看直线变化", cues: ["text 第 2 句"] },
    ],
  ),
  shot_03: shotArtifactBase(
    "shot_03",
    "可是房子不只看面积。我们想同时用面积、楼层、学区。把它们装进一个容器，就是 '向量' x = (x1, x2, x3)。",
    "可是，（停顿 0.3 秒）房子不只看面积。我们想同时用面积、楼层、学区。把它们装进一个容器，就是 '向量'：x 等于括号 x1，x2，x3 括号。",
    [
      { kind: "animation", duration: "14s", visual: "1D 散点图 fade 到 3D 表格", cues: ["text 第 1-2 句"] },
      { kind: "code_screen", duration: "10s", visual: "Python: x = np.array([120, 8, 1])", cues: ["text 第 3 句"] },
    ],
  ),
  shot_04: shotArtifactBase(
    "shot_04",
    "现在不是一套房，是 1000 套。每套是一行特征向量，1000 行堆起来就是矩阵 X。预测 1000 套房就一行代码：y = Xw。",
    "现在，（停顿 0.4 秒）不是一套房，是 1000 套。每套是一行特征向量，1000 行堆起来就是矩阵 X。预测 1000 套房就一行代码：y 等于大写 X 乘 w。",
    [
      { kind: "animation", duration: "16s", visual: "向量堆叠成矩阵的动画", cues: ["text 第 1-2 句"] },
      { kind: "math_overlay", duration: "10s", visual: "y = Xw 出现", cues: ["text 第 3 句"] },
    ],
  ),
  shot_05: shotArtifactBase(
    "shot_05",
    "看代码。numpy 里 X @ w 就完成了所有 1000 套房的预测。比 for 循环快几十倍——这就是向量化的工程价值。",
    "（停顿 0.3 秒）看代码。numpy 里 X @ w 就完成了所有 1000 套房的预测。（停顿 0.5 秒）比 for 循环快几十倍——这就是向量化的工程价值。",
    [
      { kind: "code_screen", duration: "12s", visual: "demos/e04b/vector_demo.py L10-L20", cues: ["text 第 1 句"] },
      { kind: "terminal", duration: "10s", visual: "运行结果 + timeit 对比", cues: ["text 第 2-3 句"] },
    ],
  ),
  shot_06: shotArtifactBase(
    "shot_06",
    "回顾：从一个特征，到向量，到矩阵——核心是 '把多组数据装进一个紧凑表达'。下期，我们看怎么找到最好的 w——损失函数与梯度。",
    "回顾：（停顿 0.4 秒）从一个特征，到向量，到矩阵——核心是 '把多组数据装进一个紧凑表达'。（停顿 0.6 秒）下期，我们看怎么找到最好的 w——损失函数与梯度。",
    [
      { kind: "summary_card", duration: "10s", visual: "回顾卡：3 阶段图标", cues: ["text 第 1 句"] },
      { kind: "teaser", duration: "8s", visual: "下期预告: 损失函数曲线", cues: ["text 第 2 句"] },
    ],
  ),
};

// ============================================================================
// L3 · QA Artifact（ml_knn_e02a，warn 状态）
// ============================================================================

export const qaArtifact: QaArtifact = {
  artifact_id: "ml_knn_e02a_qa_run_2026-05-13_b1d4e5",
  node_name: "qa",
  node_version: "v1.0",
  case_id: "cases/synthetic/ml_knn_e02a",
  timestamp: "2026-05-13 11:08:32",
  episode_id: "ml_knn_e02a",
  plan_artifact_id: "ml_knn_e02a_plan_run_2026-05-13_a91c33",
  shot_artifact_ids: [
    "ml_knn_e02a_shot_01_run_2026-05-13_e1",
    "ml_knn_e02a_shot_02_run_2026-05-13_e2",
    "ml_knn_e02a_shot_03_run_2026-05-13_e3",
    "ml_knn_e02a_shot_04_run_2026-05-13_e4",
    "ml_knn_e02a_shot_05_run_2026-05-13_e5",
  ],
  materials: [
    { kind: "prompts", name: "qa/episode_check", version: "v1.0", tag: "business_policy" },
    { kind: "rubrics", name: "qa/episode", version: "v1.0" },
    { kind: "schemas", name: "qa_report", version: "v1.0" },
  ],
  token_used: 9210,
  latency_s: 21.4,
  cost_usd: 0.18,
  overall_verdict: "fail",
  issues: [
    {
      dimension: "duration_alignment",
      verdict: "fail",
      affected_shots: ["shot_03"],
      description: "shot_03 实际 text 朗读时长 145s，plan 预期 110s，偏离 +31.8%（阈值 ±25%）。",
      recommended_action: "回到 Plan Console 检查 shot_03 scope；或回 Shot Console 缩减 text 长度。",
    },
    {
      dimension: "duration_alignment",
      verdict: "fail",
      affected_shots: ["shot_05"],
      description: "shot_05 实际 text 朗读时长 78s，plan 预期 110s，偏离 -29.1%（阈值 ±25%）。",
      recommended_action: "Shot 内容相对 plan scope 偏薄，建议回 Shot Console 补充 demo 解说。",
    },
    {
      dimension: "style_drift",
      verdict: "pass",
      affected_shots: [],
      description: "5 个 shot 风格一致，未检出 drift。",
      recommended_action: "无需动作。",
    },
    {
      dimension: "transition_cohesion",
      verdict: "pass",
      affected_shots: [],
      description: "shot 衔接（outgoing → incoming）顺畅。",
      recommended_action: "无需动作。",
    },
    {
      dimension: "terminology_consistency",
      verdict: "pass",
      affected_shots: [],
      description: "术语 '最近邻 / k 值 / 距离度量' 在 5 个 shot 内一致。",
      recommended_action: "无需动作。",
    },
  ],
  decision_trace: {
    prompt_template_id: "prompts/qa/episode_check@v1.0",
    rendered_prompt_diff: "+ 5 个 shot artifact 注入 (text + text_tts + notes)\n+ plan artifact 注入 (shots[] + target_duration)",
    materials_injected: {
      plan_ref: "ml_knn_e02a_plan@v1.0",
      rubric: "qa/episode@v1.0",
    },
    exemplars_used: [],
    llm_thinking_summary:
      "对 5 个 shot 跑 5 个一致性维度。duration_alignment 用 TTS 估算时长 vs plan 预期；shot_03 / shot_05 双向偏离阈值即标 fail。其他 3 维度全过。",
  },
  eval: [
    {
      dimension: "duration_alignment",
      verdict: "fail",
      attribution: {
        violated_rule_ref: "rubrics/qa/episode@v1.0#duration_threshold_25pct",
        violated_anchor: "rubrics/qa/episode@v1.0#duration_anchor_fail",
        citation_in_artifact: "shot_03 / shot_05",
        judge_thinking: "两个 shot 偏离阈值 ±25%。整 episode 标 fail。",
      },
    },
  ],
  feedback_history: [],
  metrics: {
    pass_rate: "6/9 (67%)",
    avg_tokens: "9.2K",
    budget_state: "L0, 1/3 rounds",
    avg_latency: "21.4s",
    feedback_queue: "0 触发中",
    avg_cost: "$0.18",
  },
};

// ============================================================================
// 辅助 lookup
// ============================================================================

export const findEpisode = (id: string): Episode | undefined =>
  episodes.find((e) => e.id === id);

export const findShotArtifact = (id: string): ShotArtifact | undefined =>
  shotArtifacts[id];

// ============================================================================
// L1 出口产物（业务使用者可见，纪律 #3：不含 DT / EA / rubric）
// 用于 done 卡片的三个产物按钮（scripts.md / shots/ / qa_report）
// ============================================================================

export interface ArtifactScript {
  title: string;
  episode_id: string;
  total_duration_seconds: number;
  shot_count: number;
  materials_version: string;
  generated_at: string;
  sections: { shot_id: string; intent: string; heading: string; body: string }[];
}

export interface ArtifactShotYaml {
  shot_id: string;
  intent: string;
  target_duration_seconds: number;
  text: string;
  text_tts: string;
  notes: {
    panels: { time_range: [number, number]; visual: string; narration_ref: string }[];
    transitions: string[];
  };
}

export interface ArtifactQaDimension {
  dimension: string;
  verdict: "pass" | "fail";
  detail: string;
}

export interface ArtifactQaReport {
  episode_id: string;
  title: string;
  shot_total: number;
  shot_pass: number;
  overall_verdict: "pass" | "fail";
  generated_at: string;
  total_duration_seconds: number;
  target_duration_seconds: number;
  duration_delta_pct: number;
  dimensions: ArtifactQaDimension[];
  warnings: string[];
  materials_snapshot: string[];
}

export interface EpisodeArtifacts {
  scripts: ArtifactScript;
  shots: ArtifactShotYaml[];
  qa_report: ArtifactQaReport;
}

export const mockArtifacts: Record<string, EpisodeArtifacts> = {
  ml_lr_e04b: {
    scripts: {
      title: "线性回归 · 向量与矩阵",
      episode_id: "ml_lr_e04b",
      total_duration_seconds: 610,
      shot_count: 6,
      materials_version: "plan@v1.2 / shot@v1.0 / qa@v1.0 / ml_course@v1.2",
      generated_at: "2026-05-13 10:42:18",
      sections: [
        {
          shot_id: "shot_01",
          intent: "hook",
          heading: "shot_01 · hook（约 60s）",
          body: [
            "想象一个场景：你正在帮朋友看房，他给你甩了一堆数据——面积、楼层、是不是学区房、装修怎么样——然后问你这套房子大概值多少钱。",
            "你脑子里其实已经在做一件很机器学习的事：你看这些 '特征'，给出一个数值预测。这就是 regression，回归。",
            "整个机器学习里，最朴素、最经典的一个回归模型，就是线性回归。今天这一集，我们不上来就甩公式，而是从这道你已经会做的题出发，一步一步推到为什么后面那些课件里写的 X、w、矩阵乘法长那样。",
          ].join("\n\n"),
        },
        {
          shot_id: "shot_02",
          intent: "setup",
          heading: "shot_02 · setup（约 90s）",
          body: [
            "我们先把直觉写成数学。假设只看一个特征——面积——记作 x；预测的房价记作 y。",
            "最简单的关系是什么？画在坐标轴上，是一条直线。直线就两个参数：斜率和截距。我们把斜率叫 w，截距叫 b。整个模型就一句话：y = wx + b。",
            "w 控制 '面积每多一平米，价格涨多少'，b 控制 '面积为零时，价格的基线在哪'。这就是一元线性模型——一个特征 x，一个输出 y。后面所有花哨的拓展，都是从这条直线长出来的。",
          ].join("\n\n"),
        },
        {
          shot_id: "shot_03",
          intent: "extend",
          heading: "shot_03 · extend（约 110s）",
          body: [
            "但你心里清楚——光看面积不够。同样 80 平米，一个在地铁口学区房，一个在郊区步梯六楼，价格能差一倍。所以我们要同时用 N 个特征：面积、楼层、是不是学区、有没有电梯……",
            "怎么把这一组特征装进数学里？答案是：用一个 '容器' 把它们摞起来。这个容器在数学里有现成名字——向量。",
            "我们写成 x = (x1, x2, x3, …, xn)。注意，这里 x 不再是一个数字，而是一组数字。一个特征叫标量，N 个特征拼起来叫向量。这不是新概念在难为你——它就是 '一行 Excel 表格里那一整排数据'。把 '一行特征' 当成一个整体来思考，是从一元走向多元的关键一步。",
          ].join("\n\n"),
        },
        {
          shot_id: "shot_04",
          intent: "formalize",
          heading: "shot_04 · formalize（约 130s）",
          body: [
            "现在再加一步。你手里不是一套房，是数据库里 1000 套房。每一套都是一个特征向量。把这 1000 个向量竖着摞起来，就得到一张 1000 行 × N 列的表——这张表，就叫矩阵，记作大写的 X。",
            "记住这个心智图：行 = 一个样本（一套房），列 = 一个特征（面积 / 楼层 / 学区）。矩阵不是新发明的怪物，它就是 'N 个向量堆出来的二维容器'。",
            "有了 X，预测 1000 套房的价格，整个模型也跟着升级。原来一元的 y = wx + b 变成什么？变成 y = Xw。一个矩阵乘一个向量，瞬间得到 1000 个预测值。这一步看起来只是符号换了一下，但它把 '用一堆 for 循环算 1000 次'，变成了 '一次矩阵运算搞定'——后面你会看到这件事对工程意味着什么。",
          ].join("\n\n"),
        },
        {
          shot_id: "shot_05",
          intent: "payoff",
          heading: "shot_05 · payoff（约 110s）",
          body: [
            "我们来看代码。打开 numpy，假设 X 是 (1000, 4) 的矩阵，w 是长度 4 的向量。预测全部 1000 套房，只需要一行：y = X @ w。",
            "@ 这个符号，在 numpy 里就是矩阵乘法。这一行代码，做的事情等价于一个 1000 次的 for 循环，每次都算 w1·x1 + w2·x2 + w3·x3 + w4·x4。",
            "为什么不直接写 for 循环？因为 numpy 底层是用 C 写的、是向量化的——它会把这件事丢给 BLAS / SIMD 去做。我跑过一次：1000 条样本，for 循环要 12 毫秒，X @ w 只要 0.3 毫秒，快 40 倍。这就是 '把数学写成矩阵' 在工程上的真正回报：表达更紧凑，跑得还更快。",
          ].join("\n\n"),
        },
        {
          shot_id: "shot_06",
          intent: "close",
          heading: "shot_06 · close（约 110s）",
          body: [
            "我们再回头看一眼这一集走的路：从一套房，到一个特征 x；从一个特征，到一组特征向量 x；再从一个向量，到 1000 个样本堆出来的矩阵 X。核心是同一件事——'把多组数据装进一个紧凑的表达里'。这就是线性代数在机器学习里最朴素的作用。",
            "回想 shot_01 那道房价题——现在你已经能把它写成 y = Xw，并且用一行 numpy 跑完了。",
            "但是问题没完：我们还没回答最关键的一步——w 是哪来的？怎么找到 '最好' 的那一组 w？这就要请出下一集的两位主角：损失函数（loss function）和梯度（gradient）。下期见。",
          ].join("\n\n"),
        },
      ],
    },
    shots: [
      {
        shot_id: "shot_01",
        intent: "hook",
        target_duration_seconds: 60,
        text: "想象一个场景：你正在帮朋友看房，他给你甩了一堆数据——面积、楼层、是不是学区房、装修怎么样——然后问你这套房子大概值多少钱。你脑子里其实已经在做一件很机器学习的事：你看这些 '特征'，给出一个数值预测。这就是 regression，回归。整个机器学习里，最朴素、最经典的一个回归模型，就是线性回归。今天这一集，我们从这道你已经会做的题出发，一步一步推到 X、w、矩阵乘法长那样。",
        text_tts:
          "想象一个场景。（停顿 0.4 秒）你正在帮朋友看房，他给你甩了一堆数据——面积、楼层、是不是学区房、装修怎么样——然后问你，这套房子大概值多少钱？（停顿 0.5 秒）你脑子里其实已经在做一件很机器学习的事：你看这些 '特征'，给出一个数值预测。这就是 regression，回归。（停顿 0.4 秒）整个机器学习里，最朴素、最经典的一个回归模型，就是线性回归。今天这一集，我们从这道你已经会做的题出发，一步一步推到大写 X、w、矩阵乘法长那样。",
        notes: {
          panels: [
            { time_range: [0, 18], visual: "户型图 + 多个特征气泡（面积 / 楼层 / 学区 / 装修）逐个浮现", narration_ref: "text[0:90]" },
            { time_range: [18, 38], visual: "镜头切到散点图，x 轴 = 面积，y 轴 = 价格，散点逐个落下", narration_ref: "text[90:170]" },
            { time_range: [38, 60], visual: "屏幕居中浮现关键词 '线性回归'，下方副标题 'regression'", narration_ref: "text[170:]" },
          ],
          transitions: ["开场无前 shot，直接 fade in 户型图", "末尾 hold 关键词卡 1.5s，cross-fade 到 shot_02"],
        },
      },
      {
        shot_id: "shot_02",
        intent: "setup",
        target_duration_seconds: 90,
        text: "我们先把直觉写成数学。假设只看一个特征——面积——记作 x；预测的房价记作 y。最简单的关系画在坐标轴上是一条直线。直线就两个参数：斜率和截距。我们把斜率叫 w，截距叫 b。整个模型就一句话：y = wx + b。w 控制 '面积每多一平米，价格涨多少'，b 控制 '面积为零时，价格的基线在哪'。这就是一元线性模型——一个特征 x，一个输出 y。后面所有花哨的拓展，都是从这条直线长出来的。",
        text_tts:
          "我们先把直觉写成数学。（停顿 0.3 秒）假设只看一个特征，面积，记作 x；预测的房价记作 y。（停顿 0.4 秒）最简单的关系画在坐标轴上，是一条直线。直线就两个参数：斜率和截距。我们把斜率叫 w，截距叫 b。整个模型就一句话——y 等于 w 乘 x 加 b。（停顿 0.6 秒）w 控制 '面积每多一平米，价格涨多少'，b 控制 '面积为零时，价格的基线在哪'。（停顿 0.3 秒）这就是一元线性模型，一个特征 x，一个输出 y。后面所有花哨的拓展，都是从这条直线长出来的。",
        notes: {
          panels: [
            { time_range: [0, 20], visual: "保留 shot_01 的散点图，淡入一条候选直线", narration_ref: "text[0:60]" },
            { time_range: [20, 55], visual: "直线公式 y = wx + b 出现在右上角，w 和 b 用不同颜色高亮", narration_ref: "text[60:170]" },
            { time_range: [55, 90], visual: "拖动 w / b 滑块，演示直线斜率和截距的变化", narration_ref: "text[170:]" },
          ],
          transitions: ["前接 shot_01：散点图保留，仅淡入直线", "末尾固定公式 y = wx + b 0.8s，再过渡到 shot_03"],
        },
      },
      {
        shot_id: "shot_03",
        intent: "extend",
        target_duration_seconds: 110,
        text: "但你心里清楚——光看面积不够。同样 80 平米，一个在地铁口学区房，一个在郊区步梯六楼，价格能差一倍。所以我们要同时用 N 个特征：面积、楼层、是不是学区、有没有电梯……怎么把这一组特征装进数学里？答案是：用一个 '容器' 把它们摞起来。这个容器在数学里有现成名字——向量。我们写成 x = (x1, x2, x3, …, xn)。注意，这里 x 不再是一个数字，而是一组数字。一个特征叫标量，N 个特征拼起来叫向量。它就是 '一行 Excel 表格里那一整排数据'。",
        text_tts:
          "但是，（停顿 0.3 秒）你心里清楚——光看面积不够。同样 80 平米，一个在地铁口学区房，一个在郊区步梯六楼，价格能差一倍。（停顿 0.5 秒）所以我们要同时用 N 个特征：面积、楼层、是不是学区、有没有电梯……（停顿 0.4 秒）怎么把这一组特征装进数学里？答案是：用一个 '容器' 把它们摞起来。这个容器在数学里有现成名字，向量。（停顿 0.5 秒）我们写成，x 等于括号，x1，x2，x3，省略号，xn，括号。（停顿 0.4 秒）注意，这里 x 不再是一个数字，而是一组数字。一个特征叫标量，N 个特征拼起来叫向量。它就是 '一行 Excel 表格里那一整排数据'。",
        notes: {
          panels: [
            { time_range: [0, 25], visual: "并列两套户型图：'学区 / 地铁' vs '郊区 / 六楼'，价格悬殊", narration_ref: "text[0:80]" },
            { time_range: [25, 70], visual: "Excel 表格淡入，高亮第一行，多个单元格 = 多特征", narration_ref: "text[80:200]" },
            { time_range: [70, 110], visual: "Excel 表格的一行抽出，旋转成向量 x = (x1, x2, x3, ...)", narration_ref: "text[200:]" },
          ],
          transitions: ["前接 shot_02：直线公式 fade，引出 '只看面积不够' 的对比", "末尾向量公式 hold 1s 进 shot_04"],
        },
      },
      {
        shot_id: "shot_04",
        intent: "formalize",
        target_duration_seconds: 130,
        text: "现在再加一步。你手里不是一套房，是数据库里 1000 套房。每一套都是一个特征向量。把这 1000 个向量竖着摞起来，就得到一张 1000 行 × N 列的表——这张表，就叫矩阵，记作大写的 X。行 = 一个样本（一套房），列 = 一个特征（面积 / 楼层 / 学区）。矩阵不是新发明的怪物，它就是 'N 个向量堆出来的二维容器'。有了 X，原来一元的 y = wx + b 变成 y = Xw。一个矩阵乘一个向量，瞬间得到 1000 个预测值。这把 '一堆 for 循环算 1000 次'，变成了 '一次矩阵运算搞定'。",
        text_tts:
          "现在，（停顿 0.4 秒）再加一步。你手里不是一套房，是数据库里 1000 套房。（停顿 0.4 秒）每一套都是一个特征向量。把这 1000 个向量竖着摞起来，就得到一张 1000 行 乘 N 列的表——这张表，就叫矩阵，记作大写的 X。（停顿 0.6 秒）记住这个心智图：行 等于 一个样本，一套房；列 等于 一个特征，面积、楼层、学区。（停顿 0.4 秒）矩阵不是新发明的怪物，它就是 'N 个向量堆出来的二维容器'。（停顿 0.5 秒）有了大写 X，原来一元的 y 等于 w 乘 x 加 b，变成 y 等于 大写 X 乘 w。一个矩阵乘一个向量，瞬间得到 1000 个预测值。这把 '一堆 for 循环算 1000 次'，变成了 '一次矩阵运算搞定'。",
        notes: {
          panels: [
            { time_range: [0, 30], visual: "shot_03 的向量复制 + 旋转 90°，逐个堆叠成矩阵", narration_ref: "text[0:80]" },
            { time_range: [30, 75], visual: "矩阵 X 的行列标注：行 = 样本（户型缩略图），列 = 特征（标签）", narration_ref: "text[80:180]" },
            { time_range: [75, 130], visual: "对比左右：左 y = wx + b（一元）vs 右 y = Xw（矩阵），高亮形状变化", narration_ref: "text[180:]" },
          ],
          transitions: ["前接 shot_03：向量从单条变多条堆叠", "末尾 y = Xw 公式 hold 1.2s 进 shot_05 代码画面"],
        },
      },
      {
        shot_id: "shot_05",
        intent: "payoff",
        target_duration_seconds: 110,
        text: "看代码。打开 numpy，假设 X 是 (1000, 4) 的矩阵，w 是长度 4 的向量。预测全部 1000 套房，只需要一行：y = X @ w。@ 这个符号，在 numpy 里就是矩阵乘法。这一行代码等价于一个 1000 次的 for 循环，每次都算 w1·x1 + w2·x2 + w3·x3 + w4·x4。为什么不直接写 for 循环？因为 numpy 底层是用 C 写的、向量化的——它把这件事丢给 BLAS / SIMD 去做。我跑过一次：1000 条样本，for 循环要 12 毫秒，X @ w 只要 0.3 毫秒，快 40 倍。这就是 '把数学写成矩阵' 在工程上的真正回报。",
        text_tts:
          "（停顿 0.3 秒）看代码。打开 numpy，假设大写 X 是 1000 行 4 列的矩阵，w 是长度 4 的向量。（停顿 0.4 秒）预测全部 1000 套房，只需要一行——y 等于 大写 X at w。（停顿 0.5 秒）at 这个符号，在 numpy 里就是矩阵乘法。这一行代码等价于一个 1000 次的 for 循环，每次都算 w1 乘 x1 加 w2 乘 x2 加 w3 乘 x3 加 w4 乘 x4。（停顿 0.5 秒）为什么不直接写 for 循环？因为 numpy 底层是用 C 写的、向量化的——它把这件事丢给 BLAS / SIMD 去做。（停顿 0.4 秒）我跑过一次：1000 条样本，for 循环要 12 毫秒，X at w 只要 0.3 毫秒，快 40 倍。这就是 '把数学写成矩阵' 在工程上的真正回报。",
        notes: {
          panels: [
            { time_range: [0, 25], visual: "IDE 截图：import numpy as np; X.shape=(1000,4); w.shape=(4,)", narration_ref: "text[0:80]" },
            { time_range: [25, 65], visual: "高亮代码：y = X @ w；左侧 for 循环展开成 4 项加和", narration_ref: "text[80:200]" },
            { time_range: [65, 110], visual: "终端 timeit 输出：for-loop 12.1 ms vs vectorized 0.31 ms 柱状对比", narration_ref: "text[200:]" },
          ],
          transitions: ["前接 shot_04：y = Xw 公式 morph 成代码字符 'X @ w'", "末尾终端结果 hold 1.5s 进 shot_06 总结"],
        },
      },
      {
        shot_id: "shot_06",
        intent: "close",
        target_duration_seconds: 110,
        text: "再回头看一眼这一集走的路：从一套房，到一个特征 x；从一个特征，到一组特征向量 x；再从一个向量，到 1000 个样本堆出来的矩阵 X。核心是同一件事——'把多组数据装进一个紧凑的表达里'。这就是线性代数在机器学习里最朴素的作用。回想 shot_01 那道房价题——现在你已经能把它写成 y = Xw，并且用一行 numpy 跑完了。但问题没完：我们还没回答最关键的一步——w 是哪来的？怎么找到 '最好' 的那一组 w？这就要请出下一集的两位主角：损失函数（loss function）和梯度（gradient）。下期见。",
        text_tts:
          "（停顿 0.5 秒）再回头看一眼这一集走的路：从一套房，到一个特征 x；（停顿 0.3 秒）从一个特征，到一组特征向量 x；（停顿 0.3 秒）再从一个向量，到 1000 个样本堆出来的矩阵 大写 X。（停顿 0.6 秒）核心是同一件事——'把多组数据装进一个紧凑的表达里'。这就是线性代数在机器学习里最朴素的作用。（停顿 0.5 秒）回想 shot_01 那道房价题——现在你已经能把它写成 y 等于 大写 X 乘 w，并且用一行 numpy 跑完了。（停顿 0.5 秒）但问题没完：我们还没回答最关键的一步——w 是哪来的？怎么找到 '最好' 的那一组 w？（停顿 0.4 秒）这就要请出下一集的两位主角：损失函数，loss function；和梯度，gradient。（停顿 0.4 秒）下期见。",
        notes: {
          panels: [
            { time_range: [0, 35], visual: "三阶段回顾卡：特征 → 向量 → 矩阵，三个图标横向排列", narration_ref: "text[0:120]" },
            { time_range: [35, 70], visual: "回放 shot_01 户型图 + shot_05 终端结果，呼应闭环", narration_ref: "text[120:240]" },
            { time_range: [70, 110], visual: "下期预告卡：损失函数曲线 + 梯度箭头", narration_ref: "text[240:]" },
          ],
          transitions: ["前接 shot_05：终端窗口缩小成右下角缩略图", "末尾 fade out 到下期预告，episode end"],
        },
      },
    ],
    qa_report: {
      episode_id: "ml_lr_e04b",
      title: "线性回归 · 向量与矩阵",
      shot_total: 6,
      shot_pass: 6,
      overall_verdict: "pass",
      generated_at: "2026-05-13 10:38:51",
      total_duration_seconds: 610,
      target_duration_seconds: 600,
      duration_delta_pct: 1.7,
      dimensions: [
        {
          dimension: "cross_shot_consistency",
          verdict: "pass",
          detail:
            "6 个 shot 概念递进顺滑：shot_02（一元 y = wx + b）→ shot_03（向量 x）→ shot_04（矩阵 X，y = Xw）→ shot_05（numpy @ 实现），每一跳都有明确的 '上一形状 → 下一形状' 桥接，未出现概念跳跃或缺环。",
        },
        {
          dimension: "duration_alignment",
          verdict: "pass",
          detail:
            "总时长 610s，目标 600s，偏差 +1.7%（阈值 ±25%）。每个 shot 实际朗读时长与 plan 预期偏差均在 ±10% 以内。",
        },
        {
          dimension: "terminology_consistency",
          verdict: "pass",
          detail:
            "核心术语 '特征 / 标量 / 向量 / 矩阵 / 样本 / 预测值' 在 6 个 shot 内用法一致；中英术语对照（regression / vector / matrix）首次出现时给出中英文，后续仅用中文，符合 ml_course@v1.2 风格。",
        },
        {
          dimension: "callback_coverage",
          verdict: "pass",
          detail:
            "shot_06.callbacks 显式回指 shot_01（loop_close）：用 '回想 shot_01 那道房价题' 闭环 hook。同时 shot_05 的代码 demo 自然回收了 shot_04 的 y = Xw，形成 math → code 的回报闭环。",
        },
        {
          dimension: "style_drift",
          verdict: "pass",
          detail:
            "6 个 shot 风格基线一致：句长中位数 18-26 字，口语化率 > 70%，未检出书面体侵入或语气漂移。",
        },
        {
          dimension: "transition_cohesion",
          verdict: "pass",
          detail:
            "每个 shot 的 outgoing_state 与下一 shot 的 incoming_context 严格对齐；notes.transitions 给出可执行的视觉过渡指引（fade / morph / hold）。",
        },
      ],
      warnings: [],
      materials_snapshot: [
        "rubrics/qa/episode@v1.0",
        "rubrics/plan@v1.1",
        "rubrics/shot/text@v1.0",
        "rubrics/shot/tts@v1.0",
        "style_guides/ml_course@v1.2",
        "schemas/qa_report@v1.0",
      ],
    },
  },
};

export const findEpisodeArtifacts = (id: string): EpisodeArtifacts | undefined =>
  mockArtifacts[id];

// ============================================================================
// 跨仓 JSON 契约样本（pipeline_io 输出形态）
// 参 docs/repo-layout.md §2.2 + ADRs/021.md。
//
// 注意：上面 mockArtifacts.* 是 doc-maker 内部格式（人可读 markdown/yaml）；
// 下面 mockCrossRepoJson 是经 pipeline_io 转换 + sha256 校验后写入
// astral-pipeline 仓的真实跨仓格式（按当前 §2.2 三件 JSON 形态）。
// ============================================================================

export interface CrossRepoJsonSample {
  path: string;
  content: string; // JSON.stringify result，viewer 用 <pre> 显示
}

export interface EpisodeCrossRepoJson {
  script: CrossRepoJsonSample;
  visual_spec: CrossRepoJsonSample;
  qa: CrossRepoJsonSample;
}

const _scriptJson = {
  schema_version: "1.0",
  episode_id: "ml_lr_e04b",
  title: "线性回归 · 向量与矩阵",
  target_duration_s: 600,
  produced_at: "2026-05-13T09:24:00Z",
  materials_versions: { plan: "v1.2", shot: "v1.0" },
  shots: [
    {
      shot_id: "shot_01",
      text: "我们想预测房价。给定一栋房子的面积、卧室数、楼层…",
      text_tts: "我们想预测房价。给定一栋房子的面积，卧室数，楼层…",
      target_duration_seconds: 60,
    },
    {
      shot_id: "shot_02",
      text: "从房价例子抽出 y = wx + b 一元线性模型…",
      text_tts: "从房价例子抽出 y 等于 w 乘 x 加 b 这个一元线性模型…",
      target_duration_seconds: 90,
    },
    "/* shot_03 ... shot_06 省略 */",
  ],
  sha256: "abc123def4567890fedcba0987654321...",
};

const _visualSpecJson = {
  schema_version: "1.0",
  episode_id: "ml_lr_e04b",
  shots: [
    {
      shot_id: "shot_01",
      notes: "散点图引入：从单点（一栋房子）到散点云（多栋房子），高亮 y = 房价、x = 面积",
      panels: [
        { time_range: [0, 15], visual: "单点 + 标签 (面积, 房价)", narration_ref: "我们想预测房价" },
        { time_range: [15, 45], visual: "扩展到散点云", narration_ref: "给定一栋房子的面积、卧室数、楼层" },
      ],
      transitions: ["fade-in to scatter"],
    },
    "/* shot_02 ... shot_06 省略 */",
  ],
  sha256: "def456ghi7890abc1234567890fedcba...",
};

const _qaJson = {
  schema_version: "1.0",
  episode_id: "ml_lr_e04b",
  verdict: "pass",
  score_overall: 0.94,
  dimensions: [
    {
      name: "cross_shot_consistency",
      verdict: "pass",
      detail: "术语 / 概念递进 / 风格基线一致",
    },
    {
      name: "duration_alignment",
      verdict: "pass",
      actual_s: 610,
      target_s: 600,
      deviation_pct: 1.7,
    },
    "/* terminology_consistency / callback_coverage / arc_completeness / style_drift / transition_cohesion 省略 */",
  ],
  warnings: [],
  produced_at: "2026-05-13T09:25:30Z",
  sha256: "ghi789jkl0123456789abcdef0123456...",
};

export const mockCrossRepoJson: Record<string, EpisodeCrossRepoJson> = {
  ml_lr_e04b: {
    script: {
      path: "astral-pipeline/episodes/ml_lr_e04b/raw/script/ml_lr_e04b.script.json",
      content: JSON.stringify(_scriptJson, null, 2),
    },
    visual_spec: {
      path: "astral-pipeline/episodes/ml_lr_e04b/raw/visual_spec/ml_lr_e04b.visual_spec.json",
      content: JSON.stringify(_visualSpecJson, null, 2),
    },
    qa: {
      path: "astral-pipeline/episodes/ml_lr_e04b/raw/qa/ml_lr_e04b.qa.json",
      content: JSON.stringify(_qaJson, null, 2),
    },
  },
};

export const findCrossRepoJson = (
  id: string,
): EpisodeCrossRepoJson | undefined => mockCrossRepoJson[id];
