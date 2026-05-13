# 业务案例：PPT→讲解视频 技术方案设计

> **位置**：_future/business-design.md。**业务侧（PPT→视频）设计**，第二轮才动手开发。
> MVP 过线前**不读**。框架 MVP 出口判据见 [`../07-acceptance.md`](../07-acceptance.md) §5。
>
> 配套：[`../02-architecture.md`](../02-architecture.md)（框架本体，本文档与之冲突以 02 为准）、[`../ADRs/`](../ADRs/)（决策依据，本文档聚焦"怎么做"，决策的"为什么"参见对应 ADR）。
>
> 适用范围：第一期单章节（如"机器学习 · 线性回归 · 概念篇"，~10 分钟）。系列级（多期跨章节）按同构 hierarchy 递归套用，不在本文档实现范围内。

---

## 1. 概述

### 1.1 业务目标
- **输入**：一份章节级**原始语料** + 章节主题 + 系列 const（style guide / 术语表 / 人设）+ 目标时长。
  - 原始语料格式不锁定：PPT、Markdown / 长文档、Notion 页面、讲义、视频脚本、研究笔记、混合素材均可。解析层负责把异构格式归一为内部表示。
- **输出**：一段完整讲解视频（多 shot 拼接），风格、上下文、叙事保持一致。每个 shot 产出**三件套**：
  - `text` —— 字幕原文（观众可读的台词）
  - `text_tts` —— TTS 友好的发音稿（数字读法、停顿、特殊术语注音）
  - `notes` —— 视频制作指导（镜头 / 布局 / 切换 / demo 引用）
- **核心指标**：**Shadow Autonomy Rate** —— 假设人不看，原始输出能否直接用。按节点单独度量，不只看端到端。

### 1.2 核心设计原则

1. **Workflow 外壳 + Agentic 节点**：流程骨架确定性，少数高方差节点长出 agent 能力。
2. **分层粒度，非均匀**：稳定节点粗粒度，高频重做节点细粒度到 shot 甚至 sub-shot。
3. **Shot 之间永不互读**：所有跨 shot 约束 → 预协调到 plan 或后置 QA。
4. **先搭最稳最贵跑通，再降配**：拒绝"先省着搭"的归因黑洞。
5. **第一版禁止编排 framework**：纯 Python + asyncio，Langfuse 例外（早接）。
6. **物料全版本化，反馈分层归因**：避免 prompt 变成"诅咒"。
7. **管理界面与节点同粒度**：禁止聚合 console，避免在管理层重新引入耦合。

---

## 2. 整体架构

### 2.1 Workflow 骨架

```
[原始语料]
[章节主题]               ┌──────────────────────────┐
[系列 const]    ──────→  │  期级 Plan 节点 (★ ADR-004) │   ← 本文档首要节点
[target duration]        │  4 步链 + Evaluator-Optimizer │
                         └────────────┬─────────────┘
                                      │ plan.yaml（入公共仓库）
                                      ▼
                ┌─────────────────────────────────────────────────┐
                │  shot 级执行（N 个 shot 并行，永不互读）        │
                │  ┌─ ShotExecutionNode ─┐  ┌── ... ──┐          │
                │  │  Step 1: text       │                       │
                │  │  Step 2: text_tts   │  ← 节点内 3 步链       │
                │  │  Step 3: notes      │    (★ 见 §4)          │
                │  └─────────────────────┘                       │
                └────────────────────┬────────────────────────────┘
                                     │ shot artifacts (text/text_tts/notes)
                                     ▼
                  ┌──────────────────────────────────┐
                  │  期级一致性校验 + TTS + 合成      │
                  │  衔接 / 风格 drift / 总时长 / 查重 │
                  └────────────────┬─────────────────┘
                                   ▼
                              [章节视频]
```

### 2.2 节点画像与升级策略

| 节点 | 可验证 | 输入方差 | 创造性 | 失败代价 | 风格敏感 | 首版形态 | 升级方向 |
|---|---|---|---|---|---|---|---|
| 原料解析 | 高 | 低 | 低 | 吵闹 | 无 | 适配器（PPT/Markdown/Notion/...）+ 视觉模型兜底图像 | 加新格式适配器 |
| **期级 Plan**（§3） | 中 | 高 | 高 | 静默/高 | 高 | **4 步链 + Eval-Opt** | rubric / chain 内容迭代 |
| **ShotExecutionNode**（§4） | 低/中 | 中 | 高 | 静默 | 高 | **节点内 3 步链**（text → text_tts ∥ notes），单次 LLM call/step + 各步独立 rubric | 加 Eval-Opt 循环；sub-step 拆出（触发器：3 次以上想单改 sub-part） |
| TTS（音频合成） | 高 | 低 | 低 | 吵闹 | 中 | API 调用（ElevenLabs，吃 text_tts） | 换厂商 / 微调音色 |
| 画面/动效决策 | 中 | 高 | 中 | 静默 | 中 | 当前并入 ShotExecutionNode 的 `notes` 步骤 | 量大后 Tool-using agent 独立成节点 |
| 视频合成 | 高 | 低 | 低 | 吵闹 | 无 | ffmpeg | 基本不变 |
| 期级 QA | 中 | 中 | 中 | 静默 | 高 | LLM judge + 规则混合 | rubric 迭代 |

### 2.3 三层 Hierarchy（含未来扩展）

```
系列级（整门课，Deferred）
  ├── 系列 plan / 大纲 / 术语表 / 人设
  └── 期级（一章一视频，本文档范围）
        ├── 期级 plan         ← shot list + 时长 + 弧 + callback
        ├── 期级 style guide  ← 只读 const，注入每 shot
        ├── shot 级执行（并行）
        └── 期级 QA + 合成
```

---

## 3. Plan 节点详细设计 ★

### 3.1 职责
接收原料和主题，产出能驱动所有下游 shot **独立执行**的 plan artifact。整条 pipeline 的"宪法节点"。

### 3.2 内部 4 步链

```
Step 1 · 内容消化
  Input: 归一化后的原料（text + figure refs）+ 主题
  LLM call (Opus): 产出概念图谱 JSON
  Output: { concepts[], dependencies[], examples[] }

Step 2 · 叙事弧规划
  Input: Step 1 输出 + target duration
  LLM call (Opus): 设计弧结构 + 节奏 + callback 设计点
  Output: { arc: [hook → setup → ... → payoff], pacing, callbacks }

Step 3 · Shot 切分
  Input: Step 2 输出 + 系列 style guide
  LLM call (Opus + structured output): 切成 N 个 shot
  Output: shots[] 每个含 intent / scope / duration / incoming_context /
                  outgoing_state / key_concepts / callbacks / visual_hint

Step 4 · Evaluator-Optimizer 循环
  Loop (max 3 轮):
    Judge (Opus) 按 rubric 打分 → 全过则 done
    否则 → 提取改进建议 → 修订 Step 3 输出 → 再 judge
  超出 3 轮 → 标记 needs_human_review，入人工队列
```

**为什么分四步而不是一发**：
- 每步判断维度不同，混一发 LLM 顾此失彼。
- 中间产物可缓存（改 target duration 不必重做 Step 1）。
- 每步独立 eval / 迭代 / debug。

### 3.3 Plan Schema（产物）

```yaml
plan_version: "1.0"
episode_id: "ml_linreg_ch01"
title: "线性回归 · 概念篇"
target_duration_seconds: 600
narrative_arc: "直观例子 → 形式化 → 对比 → 应用边界"

# 物料版本快照（命根子：可反查"配方"）
materials:
  prompt_step_1: "plan/step1@v1.3"
  prompt_step_2: "plan/step2@v1.2"
  prompt_step_3: "plan/step3@v1.4"
  rubric: "plan/rubric@v1.1"
  style_guide_ref: "series/ml_course/style@v1.2"

terminology:
  - term: "线性回归"
    first_use_shot: "shot_02"
    definition: "..."

shots:
  - shot_id: "shot_01"
    intent: "hook"
    scope: "预测房价的直观例子，建立问题设置"
    target_duration_seconds: 60
    incoming_context: null
    outgoing_state: "观众理解'用特征预测数值'"
    key_concepts: ["特征", "预测", "数值输出"]
    callbacks: []
    visual_hint: "散点图逐步引入"

  - shot_id: "shot_02"
    intent: "setup"
    scope: "从房价例子抽出 y = wx + b"
    target_duration_seconds: 90
    incoming_context: "shot_01 的房价例子"
    outgoing_state: "观众理解线性模型数学表达"
    key_concepts: ["线性模型", "参数"]
    callbacks:
      - to: "shot_01"
        type: "concrete_to_abstract"
    visual_hint: "拟合直线动画"
  # ...

quality_checks:
  coverage: passed
  cohesion: passed
  arc_completeness: passed
  duration_alignment: passed
  executability: passed   # ★ 最关键
  style_fidelity: passed
revision_count: 1
needs_human_review: false
```

**Schema 设计三铁律**：
1. `intent` + `scope` 强约束，**措辞不约束**（留 shot 执行空间）。
2. `incoming_context` + `outgoing_state` 显式声明（shot 之间"看意图不看输出"的载体）。
3. `style_guide_ref` 用版本引用，不内嵌（系列 const 改了不污染旧 plan）。

### 3.4 节点本身 Eval

**Gold set**：5–10 期已做完且满意视频 → 人工反推 plan → 标为 ground truth。

**LLM-as-judge 维度**（judge 模型 = generator 同代 Opus）：

| 维度 | 检查 |
|---|---|
| coverage | 原料里该讲的都进 plan 了吗 |
| cohesion | 每个 shot scope 清晰且不重叠 |
| arc_completeness | hook / payoff / 转折齐全、节奏合理 |
| duration_alignment | 各 shot 时长配比合理、总和接近目标 |
| **executability** | **给定每个 shot 的 plan 切片，能否独立执行**（★） |
| style_fidelity | terminology / 风格约束都进 plan 了吗 |

**人工抽检**：5% 抽样，看真实 shot 执行结果。**plan 节点唯一真相是"下游能跑出好 shot"**。

### 3.5 已知坑与防御

| 坑 | 防御 |
|---|---|
| Plan 信息密度不足 → shot 执行靠猜 → 一致性崩 | rubric 强制含 executability；每 shot 必填 incoming/outgoing |
| Plan 过度详细 → shot 节点无空间 → 输出僵硬 | 只给 intent + constraint + visual_hint，不给台词 |
| Eval-Opt 不收敛 | max 3 轮硬上限，超出送人工评审队列 |
| Schema 演化打破历史 plan | schema 版本化，旧版保留 reader，渐进迁移 |
| 系列 const 改了旧 plan 不一致 | 存 `style_guide_ref` 版本号，不内嵌 |
| LLM call 抖动 | tenacity 重试 + Langfuse trace + 中间产物全保留 |

---

## 4. ShotExecutionNode 详细设计 ★

### 4.1 职责

接收 **Plan 切片**（单 shot 的 plan）+ 共享 const（系列 style / 期级 style guide / 术语表）+ 上一 shot 的 outgoing_state，**输出 shot 三件套** (`text` / `text_tts` / `notes`)。

> 现实参照系：源项目 `01-ML/02-LR/scripts/e04b-向量与矩阵/script.json` 每个 shot 段就长这个样子——三件套是已经在源项目里验证过的形态。

### 4.2 为什么是"一个节点 + 内部 3 步链"，而不是 3 个独立节点

按 ADR-002 五轴过：

| 轴 | 判断 | 结论 |
|---|---|---|
| 变更频率 | text 改一句 → text_tts 必跟改、notes 经常跟改 | **强耦合**，不拆 |
| 失败异质性 | 文本质量 / 发音规则 / 视频指导可执行性，失败原因不同 | 拆有道理 |
| IO 独立可定义 | text_tts 依赖 text；notes 依赖 text + visual_hint | 有方向依赖 |
| 拆开是否更简单 | 3 节点 = 三份 schema / retry / cache key 常驻税 | 不简单 |

**结论**：不拆成 3 个 Node，**节点内部 3 步链**。跟 Plan 节点的"4 步链"同构 pattern。

**vs 一发 LLM 的收益**：
- 改字幕只重跑 Step 2+3，不重做 Step 1
- 三步分别 judge（text 用文本 rubric / text_tts 用发音 rubric / notes 用可执行性 rubric）
- 失败定位精确到 step

**vs 3 独立 Node 的收益**：
- 共享 shot 上下文不必跨节点复制
- retry 边界天然一致
- 不引入"shot 内 sub-part 之间的横向通信"（违反 ADR-003 反模式）

### 4.3 内部 3 步链

```
ShotExecutionNode
═══════════════════════════════════════════════════════════
Input:
  - shot_plan_slice (来自期级 plan，含 intent / scope / duration /
                     incoming_context / outgoing_state / callbacks /
                     key_concepts / visual_hint)
  - style_guide_ref + terminology_snapshot (期级 const)
  - prev_shot_outgoing_state (上一 shot 的 outgoing，作上下文锚)

  ┌─────────────────────────────────────────────────────┐
  │ Step 1 · text 生成                                  │
  │ LLM call (主模型)                                    │
  │ Input: 全部 shot context + style                    │
  │ Output: text (字幕原文，含段落结构)                  │
  └────────────────┬────────────────────────────────────┘
                   │
        ┌──────────┴───────────┐
        ▼                      ▼
  ┌──────────────┐      ┌────────────────────────────┐
  │ Step 2       │      │ Step 3                     │
  │ text_tts     │      │ notes                      │
  │ LLM call     │      │ LLM call                   │
  │ Input: text  │      │ Input: text + visual_hint  │
  │   + 发音规则  │      │   + 镜头语言               │
  │ Output: tts  │      │ Output: 视频制作指导        │
  └──────────────┘      └────────────────────────────┘
                   │
                   ▼
            ShotArtifact (三件套合并)
```

**Step 2 / Step 3 可并行**（都只依赖 Step 1 输出，互不依赖）。

### 4.4 Schema（ShotArtifact）

```yaml
shot_artifact_version: "1.0"
shot_id: "shot_03"
episode_id: "ml_lr_e04b_vec_mat"

# 物料版本快照（命根子）
materials:
  prompt_step_1_text:    "shot/step1_text@v1.0"
  prompt_step_2_tts:     "shot/step2_tts@v1.0"
  prompt_step_3_notes:   "shot/step3_notes@v1.0"
  rubric_text:           "shot/text_rubric@v1.0"
  rubric_tts:            "shot/tts_rubric@v1.0"
  rubric_notes:          "shot/notes_rubric@v1.0"
  style_guide_ref:       "series/ml_course/style@v1.2"
  terminology_ref:       "series/ml_course/term@v1.1"

input_refs:
  plan_id:               "ml_lr_e04b_plan@v1.0"
  shot_plan_slice_index: 3
  prev_shot_outgoing:    "shot_02.outgoing_state"

# 三件套
text: |
  线性回归不只能处理一个特征。当我们把房子的面积、卧室数、楼层...
text_tts: |
  线性回归，不只能处理一个特征。当我们把房子的面积、卧室数、楼层...
  （停顿）这些都加进来，就有了向量 vector ...
notes:
  shots:
    - kind: animation
      duration: 8s
      visual: "散点图从 1D 扩展到多维"
      cues: ["text 第 1-2 句对应"]
    - kind: code_screen
      duration: 12s
      ref: "demos/e04b/vector_demo.py#L10-L20"
      cues: ["text 第 3-5 句"]

quality_checks:
  text_passed: true
  text_tts_passed: true
  notes_passed: true
  cross_step_consistency: passed   # text / text_tts / notes 三者对齐
revision_count: 0
needs_human_review: false
```

**Schema 设计三铁律**：

1. **三件套同 Artifact**：物理上一起入库，方便整体 rerun / cache。
2. **物料版本三步独立**：text 的 prompt 改不影响 text_tts 物料版本，cache key 精确到 step。
3. **`input_refs` 显式记录依赖**：`plan_id` + `slice_index` + `prev_shot_outgoing` 让任何 shot 可被独立重跑。

### 4.5 Eval 设计

各步独立 rubric，每步独立 judge：

| Step | 关键 rubric 维度 |
|---|---|
| text | scope 覆盖 / 长度匹配 / style 一致 / 术语正确 / callback 命中 / 不重复 |
| text_tts | 数字读法 / 停顿 / 术语注音 / 字符级符合 TTS 限制 |
| notes | 镜头与 text 对齐 / 时长配比 / demo 引用正确 / 可执行（操作能跑通） |
| 三步一致性（节点级） | text ↔ text_tts 内容一致 / notes 镜头节奏匹配 text 段落 |

**Gold set**：从 KNN e01-e11 / LR e04b 等已做产物的 `script.json` 反推 shot 三件套（注意：**这是业务侧第二轮的工作**，不在框架 MVP 范围）。

### 4.6 已知坑与防御

| 坑 | 防御 |
|---|---|
| text_tts 改后 text 没跟改（或反之），三件套不一致 | 节点级"cross_step_consistency" judge 兜底 |
| notes 引用了 text 里不存在的句子（行号漂移） | notes 用语义 cue 而非行号；额外校验 text 内每个语义 cue 都能 grep 到 |
| Step 2/3 并行时 LLM call 抖动，单边失败 | 并行调用各自 tenacity 重试；都失败入失败队列，不阻塞其他 shot |
| 物料版本冲突（step 1 改了但 step 2/3 没跟） | rubric 强制 "cross_step_consistency" 维度，物料 promote 前跑 regression |
| Shot 内步骤越拆越多失控 | 守住 "3 次以上单改 sub-part" 触发器，未到不拆 |

### 4.7 升级路径

| 触发 | 升级 |
|---|---|
| Step 1 text 反复打回 | text 步骤加 Evaluator-Optimizer 循环（max 3 轮） |
| Step 3 notes 出现工具调用需求（查 demo 仓库 / 截图 / 验证操作可行性） | notes 步骤升 Tool-using agent |
| Step 2 text_tts 已稳定 / 规则化 | 降配到中档模型或纯规则脚本（数字读法表 + 停顿模板） |
| 出现 3 次以上"只改 text 不动其它" | 把 text 拆为独立 Node（这才是真的拆 Node，不是拆 step） |

---

## 5. 技术栈（业务侧专属）

> **框架内核技术栈见 [`../08-tech-stack.md`](../08-tech-stack.md)**（语言 / 包管 / LLM SDK / Pydantic / Langfuse / Streamlit / asyncio / 测试 / CI 等 22 项）。本节只列**业务侧第二轮才会动用、不属于框架内核**的栈：

| 项 | 选型 | 何时引入 | 备注 |
|---|---|---|---|
| 主模型（业务 Plan 节点 generator + judge） | Claude Opus 4.7 | 业务侧第二轮 | 高 stakes 节点用顶档，ADR-006 |
| TTS | ElevenLabs API | shot 三件套出 text_tts 后 | 质量最稳；替换条件见 08 §5 |
| 视频合成 | ffmpeg | 录屏阶段 | 纯代码；可换 MoviePy |
| 期级 QA 节点 | LLM judge + 规则混合 | 业务侧第二轮 | 衔接 / 风格 drift / 总时长 / 查重 |
| 业务编排 | ~200 行 Python + asyncio | 业务侧第二轮 | 复用框架 Node Runtime，按 §2.1 workflow 骨架串 |
| 业务文档 | Markdown + Mermaid（不动态生成） | 持续 | 跟框架文档同栈 |

---

## 6. 演进路线

```
Phase 0  现状
   多条 human + cc loop，每个 loop ≈ 骨架里一个节点

Phase 1  串成 workflow，节点间留人工审核点 ← 本方案目标
   重点不是自动化，是 instrumentation：
   每节点单独采集 shadow autonomy 信号

Phase 2  弱节点先 agentic 化
   数据说话：autonomy 最低节点先升级
   通常是脚本（Eval-Opt）和画面决策（tool-using）

Phase 3  跨节点反馈（写死的反馈边）
   配音发现某句太长 → 回脚本节点重写
   画面发现某图无法可视化 → 回脚本节点改讲法

Phase 4  局部 agent 化
   某几个节点变 agent，仍在 workflow 壳里

Phase 5  整体 agent（大概率永不到达）
   只有"流程骨架本身要动态变化"才考虑
```

**每次只升级一个节点，跑两周数据，确认 autonomy 真涨了再升下一个**。Agentic 节点复杂度是 workflow 节点的 3–5 倍，贪多必死。

---

## 7. 反馈与治理

### 7.1 反馈 → 物料修改工作流

```
评审在 per-node console 提结构化反馈
        ↓
入反馈库（不立即触发改动）
        ↓
反馈队列达阈值 N 时 triage 聚类
        ↓
按 likely_cause 归因到具体层（5 层之一）
        ↓
改动前：拉 frozen regression set 跑当前 prompt 得 baseline
        ↓
改动后：再跑 regression，验证目标问题修复 + baseline 未破
        ↓
版本号 + changelog 记录（fb_id → version bump）
```

### 7.2 反馈落点 5 层

| 层级 | 触发条件 | 风险 |
|---|---|---|
| 系列 style guide / 术语表 | 多条反馈关于术语 / 风格 | 高 |
| 每步 prompt | 某字段反复标错 | 高 |
| Schema | 反馈说"想表达的东西没字段装" | 高 |
| Judge rubric | 评审觉得错但 judge 没标 | 中 |
| Few-shot exemplars | 边缘案例 | 低 |
| 单期 plan | 孤立古怪 | 无 |

### 7.3 物料版本化（强制）

```
prompts/         git，每步独立语义化版本（plan/step3@v1.4）
schemas/         Pydantic + version field
style_guides/    git yaml，版本号引用
rubrics/         同上
exemplars/       db 或 git，每条 id + 加入日期
plan.yaml        内嵌所有引用版本号 ← 命根子
```

### 7.4 Regression 集（必须建）

- 选 20–30 期已做完且满意视频 → 反推 plan → frozen。
- 任何 prompt / rubric / style guide 改动**必须先在该集上跑**，通过才上线。
- 建集本身值得花一两周专门做。

### 7.5 评审治理（Q2 反偏移）

**前提认知**：人工评审 plan **不可靠且会漂移**。最危险的是"评对了分但跟下游质量无关"。

| 措施 | 频次 |
|---|---|
| 评分表（5–7 维度 + 0/5/10 **anchor（标杆例子：0/5/10 分各对应一个具体范例）** + 反例） | 一次性建立 + 重大改动时迭代 |
| 评审校准 盲评 10 个旧 plan | 每 N 次物料 promote 前 |
| 对照样本（混 10% 已知差 plan） | 持续 |
| 多评审 + 一致性裁定 | 每个关键决策 |
| **plan 评分 vs 下游真实质量相关性校验** | **下游成品累计达阈值 N 时（最重要）** |

**长期方向**：

```
Stage 1（现在）    plan 评审是主信号
Stage 2            plan 评审 + shot 执行质量加权
Stage 3            plan 评审仅粗筛，真信号来自成品视频指标
Stage 4            plan 自动评估为主，人工只做 评审校准
```

每往后一档，系统自纠偏能力越强，人为偏移影响越小。

---

## 8. 管理界面：Per-Node UI

### 8.1 总原则
- **每节点独立 console**，禁止"全流程聚合视图"。
- 跨节点导航靠 artifact ID 超链接，**不做聚合**。
- 每个 console 独立部署 / 独立可关停。

### 8.2 操作分类

| 档 | 处置 |
|---|---|
| 必须自建（高频高密度） | per-node console |
| 现成工具 | Langfuse / Phoenix / Git / Notion / Linear / Argilla |
| 留 CLI | 批量 rerun / 物料 promote / schema migration / 指标导出 |

**不要给自己造一个 Langfuse**。

### 8.3 Plan 节点 Console（第一个要建的 UI）

单页 Streamlit，仅服务 Plan 节点：
- Plan artifact 结构化渲染（shot list 表格 + 元数据区，不是裸 JSON）
- 本次用的物料版本（prompt vX / style guide vY / rubric vZ）
- Evaluator-Optimizer 循环了几轮 + 各轮 diff
- 每个字段旁挂结构化反馈按钮
- 重新生成按钮（支持换不同物料版本对比）
- 本节点最近指标：plan 一次过率 / 平均循环轮数 / regression 通过率

**禁止显示**：任何 shot 输出、视频成品、全流程状态。想看 → 点 `shot_id` 跳到该 shot 的 console。

### 8.4 文档目录（同节点粒度）

```
nodes/
  plan/
    README.md
    prompts/
    rubric.yaml
    eval/
    ui/            ← 这节点的 Streamlit 页
  shot/
    README.md
    ...
  qa/
    README.md
    ...
index.md           ← 全系统索引：只列节点和连接，不重复细节
```

---

## 9. 业务 MVP 范围（节奏不预设）

> **说明**：本节是**业务侧** MVP（Plan 节点 / ShotExecutionNode 等业务节点的开发）。**框架 MVP** 范围见 [`../07-acceptance.md`](../07-acceptance.md)——框架第一轮**不开发任何业务节点**，本节描述的工作发生在**框架 MVP 通过之后的第二轮**。

### 业务侧第二轮启动条件

- 框架 MVP 验收（见 `../07-acceptance.md` §5）全部通过
- ToyNode dogfood 跑稳 ≥1 轮
- 框架健壮性副产物报告（`reports/dogfood_round1.md`）无阻塞性问题

满足后，业务侧第二轮才开始下面的工作。

### 业务侧第二轮阶段

**阶段 B-A · 反推与验证（零代码）**：
- 反推 5–10 期已做视频的 plan（作为 gold set 候选）
- **必做实验**：给定反推的 plan + style + 原料，某 shot 能否"看不见兄弟输出"独立产出？
  - 能 → 进 B-B
  - 不能 → 补 plan 字段直到能；极少数情况才说明 hierarchical 不成立

**阶段 B-B · Plan 节点最薄版本**：
- 单次主模型调用（不分四步、不上 Evaluator-Optimizer）
- Pydantic 强制 schema（复用框架 Materials Registry）
- 跑反推得到的真实期次
- 每份 plan 至少喂给 ShotExecutionNode 跑通 ≥2 个 shot 验证 executability
- 出两个数（不预设阈值）：plan 一次过率 / shot 可执行率

**阶段 B-C · ShotExecutionNode 最薄版本**：
- 按 §4 三步链实现（text → text_tts ∥ notes）
- 复用 §4.4 ShotArtifact schema
- 跟 Plan 节点 dogfood 共享同一批反推 case

**阶段 B-D · 数据驱动升级**：

| 数据组合 | 升级方向 |
|---|---|
| Plan 一次过率低，可执行率高 | Plan 内容质量问题 → 加 Evaluator-Optimizer |
| Plan 一次过率高，可执行率低 | Plan 信息密度问题 → 拆四步链，Step 3 加约束 |
| ShotExecutionNode 三件套交叉一致性低 | 节点级 cross_step rubric 上 + step 间 schema 加强 |
| 两个都低 | 模型或 prompt 设计问题 → 先 debug prompt 再说架构 |

**阶段 B-E · 治理工具（按需）**：
- Regression 集（20–30 期反推 plan + frozen）
- 评分表 第一版（5–7 维度 + anchor + 反例）
- 评审校准（人工盲评样本）

**阶段不预设时间，按真实数据驱动推进**。

---

## 10. 关键不变量（写在墙上）

1. **Shot 之间永不互读**。所有跨 shot 约束 → 预协调到 plan 或后置 QA。
2. **Judge ≥ Generator 同代**。绝不用弱模型 judge 强模型。
3. **Plan artifact 必须内嵌所有物料版本号**。任何产物能反查"配方"。
4. **任何 prompt/rubric/style 改动先跑 regression 集**。没通过 = 不上线。
5. **下游成品累计达阈值 N 时做 plan 评分 vs 真实质量相关性校验**。低 = 评审在自嗨，rubric 重做。
6. **per-node 责任绑定**：谁拥有节点谁拥有 prompt / rubric / UI / 文档，统统在一起。
7. **粒度变化双向操作**：3 次以上"只想改 sub-part" → 拆；两节点总一起改/失败 → 合并。

---

## 10a. 老项目对接（ai-engineer-roadmap）

> **从框架本体（[`../02-architecture.md`](../02-architecture.md) §5）挪过来**。业务对接细节属于业务侧文档，框架架构里只声明原则。

### 立场：老规则不是 ground truth

老项目 9 份 skill 文档（`_3-script-guide.md` 等共 35KB+）**全部是人凭经验写的，从未经过 eval**。直接当 v1.0 prompt = 假设老规则是好规则，与"测框架不测业务"+"白盒化可观测"两条纪律冲突。

**正确姿态**：老规则 md 是**起草 v1.0 bootstrap 的参考材料**，不是 v1.0 本身。**可能整条都是错的 / 过时的 / 不该有的**——必须经过框架批量跑 + attribution 分析 + 人工抽检后，才能逐条决定保留 / 改写 / 删除。

### 资产 → 框架落点

| 老项目资产 | 框架落点 | 用途 | 注意 |
|---|---|---|---|
| `01-ML/_3-script-guide.md` 等 9 份 skill 文档 | `materials/prompts/<node>/v1.0.md` 的**草拟起点** | 经过提炼 + 抽样 + 批量验证后，才能作为 v1.0 bootstrap | **不是直接复制粘贴**——按节点拆 + 删冗余 + 提 anchor |
| `01-ML/*/scripts/e*/script.json`（全 ML 50+ 期） | `eval/<node>/regression/` 的**候选样本池** | 反推 plan + 抽取 shot 三件套 = regression set 种子 | 必须人工筛选"满意 vs 不满意" |
| `01-ML/*/scripts/e*/plan.md` | 同上 | Plan 节点 gold 候选 | 必须验证"是否经得起 executability 实验"（§9 阶段 B-A） |
| 人评估的隐式标准 | §2a 治理实践（业务侧第二轮+） | 评审校准 起点 + 对照样本种子 | MVP 不做 |
| `_架构规则.md` 文件结构约定 | `materials/schemas/episode.py` 的**草拟起点** | 业务 schema 起点 | 转写时改 ad-hoc 字段为显式约束 |

### "重新评估老项目规则"的真实工作流

```
Step 1 · 提炼（人工，零代码）
  老 skill 文档 → 按节点拆 → 提 anchor + 反例 → 写 v1.0 草稿
  砍掉：重复 / 已过时 / 凭感觉写但说不清依据的条目

Step 2 · Bootstrap 跑批
  v1.0 + 抽样的真实 case → 跑 ToyNode（框架 MVP）或业务节点（第二轮）
  → 自动 judge with attribution

Step 3 · 三类信号分流
  ┌─ judge pass + 人工抽检赞同  → 规则确认有效
  ├─ judge fail 但 attribution 指回某条老规则 → 规则有效但物料没注入对
  ├─ judge pass 但人工抽检反对 → 规则错了 / rubric 漏维度
  └─ 大量 case attribution 都指同一条规则 fail → 该条规则可能过时，重写或删除

Step 4 · 数据驱动改物料
  按框架 Promote Pipeline 走 v1.0 → v1.1：必须有 baseline + diff + 不退化判据
  禁止凭直觉重写文档
```

### 关键约束

- v1.0 草稿可以从老规则继承文字，但**每一条都要标注"待验证"**，跑批后才升 confidence
- 跑出的第一批 artifact + 人工抽样 = **强制性** regression seed（v1.0 投产即攒种子）
- "重新评估"是循环过程，不是一次性事件——每次反馈聚类后回到 Step 3

---

## 11. 与 ADR 的索引

| 设计章节 | 决策依据 |
|---|---|
| §2 整体架构 | [`../ADRs/001.md`](../ADRs/001.md), [`../ADRs/003.md`](../ADRs/003.md) |
| §2.2 节点画像 | [`../ADRs/005.md`](../ADRs/005.md) |
| §3 Plan 节点 | [`../ADRs/004.md`](../ADRs/004.md) |
| §4 ShotExecutionNode | [`../ADRs/002.md`](../ADRs/002.md)（粒度判定）, [`../ADRs/003.md`](../ADRs/003.md)（shot 不互读）, [`../ADRs/005.md`](../ADRs/005.md)（pattern 阶梯） |
| §5 技术栈 | [`../ADRs/006.md`](../ADRs/006.md), [`../ADRs/007.md`](../ADRs/007.md) |
| §6 演进路线 | [`../ADRs/001.md`](../ADRs/001.md), [`../ADRs/005.md`](../ADRs/005.md) |
| §7 反馈与治理 | [`../ADRs/008.md`](../ADRs/008.md), [`../ADRs/009.md`](../ADRs/009.md) |
| §8 管理界面 | [`../ADRs/010.md`](../ADRs/010.md) |
| §10 不变量 | [`../ADRs/003.md`](../ADRs/003.md), [`../ADRs/006.md`](../ADRs/006.md), [`../ADRs/008.md`](../ADRs/008.md), [`../ADRs/009.md`](../ADRs/009.md) |
