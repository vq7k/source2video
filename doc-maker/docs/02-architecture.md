# 02 · source2video 架构

> **阅读位置**：02 / 10（入口：[`README.md`](./README.md)）。**本文档定位**：source2video 框架本体（业务无关）。
>
> 配套：[`03-invariants.md`](./03-invariants.md)（16 主 + 3 子不变量，墙上贴的约束）、[`business-console.md`](./business-console.md)（当前 L1 业务产品原型 SOT）、[`07-acceptance.md`](./07-acceptance.md)（业务原型验收 + framework ToyNode 历史基线）、[`_future/business-design.md`](./_future/business-design.md)（PPT→视频 业务案例参考）、[`ADRs/`](./ADRs/)（决策记录）。当本文档与 business-console / ADR-027 冲突时，按 ADR-027 的路线调整解释：框架本体仍保持业务无关，当前推进顺序切到业务产品原型。

---

## 0. 定位

**source2video = 一个 LLM workflow 流水线框架**。

### 框架要解决的真实痛点

来自老项目 `ai-engineer-roadmap`（PPT→讲解视频流水线，**全 ML 系列 50+ 期已跑完**，02-DL 在跑中）。痛点演化路径：

```
阶段 1 · 前期人工密集
  人 + cc loop 多条，规则散在脑里 + 对话里

阶段 2 · 规则积累 → 并行 + 批量（当前所处阶段）
  _3-script-guide.md / _1 / _5 ... 共 9 份 skill 文档 35KB+
  全 ML 系列章节跑完

阶段 3 · 三重崩溃 ← 这才是真痛点
  A. 评估容量崩溃 —— 50+ 期 × 多 shot × 多维度 = 几万判断，人看不完
  B. 黑盒化       —— LLM 凭啥这么写？遵守哪条？违反哪条？无追溯
  C. 迭代爆炸     —— 改物料后重跑还是黑盒，人工跟不上规模
```

框架的承诺，就这三件，**直接对应阶段 3 的 A / B**（C 是 A+B 解决后的次生缓解）：

1. **批量跑测试 + 评估容量放大**（解 A）——
   任意节点 × 任意 case 集并发执行 + LLM-as-judge 自动跑全量 rubric + 人工只做抽检与阈值校准
2. **人工可修改初始规则 + 版本化复现**（基础设施）——
   prompts / rubrics / style / schema / exemplars 全部版本化、热可改、改动可回滚、artifact 内嵌物料版本号
3. **白盒化可观测**（解 B）——
   每次 LLM call 入 trace + **decision attribution**：每条 rubric pass/fail 必须能追溯到具体规则段落 + LLM thinking 摘要 + 命中的 exemplar / citation。trace 不只是 prompt/output/token，是**"LLM 凭啥这么决策"的可解释证据链**

### 它不是什么

- **不是** LangChain / LangGraph 类通用编排框架——只服务 5–8 节点级别的 workflow
- **不是** 评测平台——Eval 复用 Langfuse / Phoenix / DeepEval 现成能力
- **不是** 业务系统——业务节点（Plan / 脚本 / 画面）都长在 `nodes/` 子目录里

### 业务边界

首个落地场景是讲解型内容，第一版 dogfood 数据来自 **PPT/教材 → 讲解视频**（接 ai-engineer-roadmap 数据）。
框架内核不绑业务；但**不为想象中的第二业务做过早抽象**，等真出现第二业务再 generalize。

---

## 1. 核心抽象（5 个一等公民）

| 抽象 | 含义 | 例子（业务实例化） |
|---|---|---|
| **Node** | 一个 workflow 节点，可内含多步 LLM call + Evaluator-Optimizer 循环 | Plan 节点 / 脚本节点 / 画面决策节点 |
| **Material** | 节点的"配方"——驱动节点行为的可版本化、可热编辑物料 | prompts / rubrics / style_guides / schemas / exemplars |
| **Artifact** | 节点的产物，**内嵌所有 Material 版本号**——可反查"配方"，可在新 Material 下重跑得到 diff | plan.yaml / script.json / shot_artifacts |
| **Case** | 一次输入实例，业务定义 schema | 一份教材 + 章主题 + 目标时长 |
| **Trace** | 一次执行的完整 trace：LLM call / 中间产物 / 失败信息 / 物料版本快照 | Langfuse trace + 本地 trace 文件 |

### Node 契约（业务无关）

```
Node.run(case: Case, materials: Materials, ctx: Context) -> RunResult

RunResult = {
  artifact:     Artifact,          # 主产物，内嵌物料版本号
  intermediates: list[Artifact],   # 中间产物（缓存键）
  trace:        Trace,             # 完整执行 trace
  signals: {
    autonomy_rate: float | None,   # 人工 diff = 0 的比例
    eval_scores:   dict,           # 各 rubric 维度分
    cost_tokens:   int,
    latency_ms:    int,
    revision_count: int,           # Eval-Opt 循环轮数
    needs_human_review: bool,
  }
}
```

**关键约束**（写在墙上的 [`03-invariants.md`](./03-invariants.md)）：

- Artifact 必须内嵌所有 Material 的版本号（[`不变量 #1`](03-invariants.md#1-artifact-必须内嵌所有用到的-material-版本号)）
- Trace 必须捕获每一次 LLM call（[`不变量 #2`](03-invariants.md#2-所有-llm-call-必经-langfuse-trace) + [`不变量 #4`](03-invariants.md#4-每次-llm-call-必须有-decision-trace)）
- Node 不读其它 Node 的 Artifact，只通过 Case 或上游 Artifact 引用（[`不变量 #9`](03-invariants.md#9-node-之间不互读-artifact只通过-case--上游-plan-中介)）
- Node 失败必须保留中间产物（可恢复重跑）

---

## 2. 模块划分（6 个）

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          source2video 框架                              │
│                                                                         │
│  ┌──[1] Node Runtime ─────────────────────────────────────────────┐    │
│  │  • Node 抽象 / 多步链 / Evaluator-Optimizer 循环                │    │
│  │  • asyncio 编排 / tenacity 重试 / 中间产物缓存                  │    │
│  │  • 失败保留 / 可恢复重跑                                        │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ┌──[2] Materials Registry ──────────────────────────────────────┐     │
│  │  prompts/ schemas/ rubrics/ style_guides/ exemplars/          │     │
│  │  • Git + 语义化版本号（plan/step3@v1.4）                       │     │
│  │  • Pydantic version field（schema 演化兼容）                   │     │
│  │  • Artifact 内嵌"配方版本号" ← 命根子                          │     │
│  │  • 人工热编辑：改 git → reload → 生效                          │     │
│  │  • rubric schema 约定：5–7 维 / 0/5/10 anchor（标杆例子）/ 反例集│     │
│  └───────────────────────────────────────────────────────────────┘     │
│                                                                         │
│  ┌──[3] Eval Stack（仅框架自动能力）─────────────────────────────┐     │
│  │  • Schema check（Pydantic 校验）                               │     │
│  │  • LLM-as-judge with attribution                               │     │
│  │      ≥ generator 同代；同节点同模型                            │     │
│  │      输出 violated_rule_ref / anchor / citation / thinking     │     │
│  │  • Auto-judge Runner：跑批后自动跑完全量 rubric × case         │     │
│  │  • Regression diff：物料 promote 前对 frozen set 跑新旧对比    │     │
│  │  （评审校准 / 对照样本 / 多评审 / 相关性校验 = 业务侧治理        │     │
│  │   实践，不在框架内核，见 §2a）                                  │     │
│  └───────────────────────────────────────────────────────────────┘     │
│                                                                         │
│  ┌──[4] Observability ───────────────────────────────────────────┐     │
│  │  • Langfuse 自托管（所有 LLM call 必经）                       │     │
│  │  • Decision Trace（rendered_prompt_diff / materials_injected / │     │
│  │                    exemplars_used / llm_thinking_summary）     │     │
│  │  • Eval Attribution 落盘（traces/eval/）                       │     │
│  │  • 节点 × case 矩阵 batch runner（CLI）                        │     │
│  │  • 人工 diff 采集（采纳 / 改写 / 重跑 → trace）                │     │
│  │  • 指标聚合：cost / latency / 失败模式                          │     │
│  │  • Shadow autonomy rate（派生 metric，每节点单独算）            │     │
│  └───────────────────────────────────────────────────────────────┘     │
│                                                                         │
│  ┌──[5] Feedback Loop ───────────────────────────────────────────┐     │
│  │  • 结构化反馈 schema（location / issue / expected /            │     │
│  │                       likely_cause / severity / reviewer）     │     │
│  │  • 收集 → 不即时改 → 反馈队列达阈值 N 时 triage 聚类           │     │
│  │  • 归因到 5 层之一（style / prompt / schema / rubric /         │     │
│  │                    exemplar / single-case）                    │     │
│  │  • baseline → diff → regression → 版本 bump + changelog        │     │
│  └───────────────────────────────────────────────────────────────┘     │
│                                                                         │
│  ┌──[6] Per-Node Console ───────────────────────────────────────┐      │
│  │  • 单节点独立 UI（artifact / 物料版本 / 反馈表单 / rerun）     │      │
│  │  • Streamlit 100–200 行/页                                    │      │
│  │  • 跨节点靠 artifact_id 超链接，**禁止聚合视图**               │      │
│  │  • 批量 rerun / 物料 promote / migration 留 CLI               │      │
│  └───────────────────────────────────────────────────────────────┘     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                  ▲
                                  │
              业务节点（nodes/plan, nodes/script, ...）
              dogfood 框架能力，不在框架内核
```

### 2.1 Node Runtime

**职责**：把一个 Node 的多步执行 + 重试 + 缓存 + Eval-Opt 循环跑起来，输出 RunResult。

**核心能力**：
- 多步链：`step_1 → step_2 → ... → step_n` 串行/并行
- Evaluator-Optimizer 循环：judge → 不过 → optimizer 修订 → 再 judge，max N 轮硬上限
- 中间产物缓存：每步 input hash 命中即跳过（schema 改动失效）
- 失败保留：任意步失败保留全部 intermediates 到 trace，支持从断点恢复
- async 并发：同一节点跨 case 并发（受 rate limit）

**LLM SDK**：统一用 **OpenAI SDK**（走 OpenAI 兼容端点）。Anthropic / 国内厂商 / 本地 Ollama 都通过 OpenAI 兼容协议接入，框架内核不感知具体 provider。**完整技术栈清单 + 包版本 + `.env.example` + `pyproject.toml` 草稿见 [`08-tech-stack.md`](./08-tech-stack.md)**。

**API（草拟）**：

```python
class Node(Protocol):
    name: str
    version: str
    materials_spec: MaterialsSpec  # 声明它需要哪些物料

    async def run(case, materials, ctx) -> RunResult: ...

class Runtime:
    async def run_one(node, case, materials_set) -> RunResult: ...
    async def run_batch(node, cases, materials_set, concurrency=8) -> BatchResult: ...
```

### 2.2 Materials Registry

**职责**：管理所有"驱动节点行为的可编辑物料"，做到版本化、可回滚、可人工热编辑、可反查。

**物料类型**（5 类）：

| 类型 | 存储 | 版本化 |
|---|---|---|
| prompts | `materials/prompts/<node>/<step>.md` | 语义化版本，每步独立 |
| schemas | `materials/schemas/<artifact>.py` | Pydantic + version field |
| rubrics | `materials/rubrics/<node>.yaml` | YAML + version |
| style_guides | `materials/style_guides/<series>.yaml` | YAML + version |
| exemplars | `materials/exemplars/<purpose>/*.yaml` | 每条 id + 加入日期 |

**热编辑流程**：人工改 git 文件 → CLI `s2v materials reload` → 生效。
**Artifact 内嵌**：每个 Artifact 头部 `materials: {prompts: "plan/step3@v1.4", ...}`——这是命根子（见 [`不变量 #1`](03-invariants.md#1-artifact-必须内嵌所有用到的-material-版本号)）。

#### 2.2.1 演化三动作（行为变化的归位规则）

行为变化触发源不同，归位也不同。**默认动作：先想能否落到 Materials；想不到才动节点代码**。

| 触发 | 动作 | 例子 |
|---|---|---|
| 审美变了（同类型同任务，标准改了） | **改 Materials**（bump 版本号） | rubric 的 "style 口语化" anchor 收紧；prompt 加一句"避免学术腔" |
| 类型变了（任务/受众/输出形态新增，旧的仍要保留） | **新增 Materials**（v1 / v2 并存或新目录） | 同节点服务"视频版"和"播客版"两种输出 → `prompts/script/video/` + `prompts/script/podcast/` |
| 节点 IO 契约变了（输入/输出 schema 真的改了） | **改节点代码**（升 Node.version） | shot artifact 新增 `subtitle_timing` 字段；输入新增 `series_glossary` 引用 |

**铁律：审美变化绝不动节点代码**（[`不变量 #11`](03-invariants.md#11-审美--标准--类型变化绝不动节点代码)）。否则代码会跟着主观偏好反复改，永远稳不下来。**节点代码只对"契约"负责，不对"风格 / 标准 / 审美"负责**。

#### 2.2.2 Promote Pipeline（v1.0 → v1.x 的硬约束）

**核心机制：Train/Holdout 双数据集 + 双向 Gate + Bounded Budget**。这套机制同时挡住两个陷阱：**蒙特卡洛随机抖动**（错误做法 1）和 **过拟合 prompt**（错误做法 2）。

##### 数据集 frozen 拆分（不变量级强约束）

```
fixtures/cases/
  ├── train/  (70%)   ← 你可见，反馈写在这上面，物料迭代基于此
  └── holdout/ (30%)  ← 锁起来，物料迭代期间禁止看，仅 CI / promote gate 跑
```

物料 bump 期间**禁止访问 holdout**——CI 检测 commit message / diff 中是否引用 holdout case id，触发即拒（[`不变量 #13`](03-invariants.md#13-fixturescases-必须-train70--holdout30-拆分)）。

##### Promote 流程

```
v1.0 · bootstrap
  ↓ 老规则 / 经验 / 直觉草拟（参考材料可来自外部文档，但不等于 ground truth）
  ↓ v1.0 不进 promote 流程——产物只是 baseline，不评对错
  ↓ v1.0 跑出的第一批 artifact + 人工抽样 = regression seed
  ↓ 同时分配到 train / holdout
  ↓
v1.x (x ≥ 1) · 必须数据驱动 + 双向 Gate
  ├─ 触发：反馈队列累积 ≥ N 条同 likely_cause（聚类阈值，建议 N=3）
  ├─ Step 1: 当前 vN 跑 train + holdout 全量，存 baseline_train_vN / baseline_holdout_vN
  ├─ Step 2: 仅看 train 反馈聚类 → 按 L0~L5 升级路径选最低代价层 → 改物料 bump → v(N+1)
  ├─ Step 3: v(N+1) 跑 train + holdout 全量
  ├─ Step 4: 双向 Gate 裁决
  │           ✓ train pass 改进 +Δ（目标问题修复，attribution 显示原 violation 不再触发）
  │           ✓ holdout pass 不退化（任一 rubric 维度 pass 数不降）
  │           任一不满足 → CI 红 → 拒绝合并（[`不变量 #14`](03-invariants.md#14-物料-bump-双向-gate)）
  └─ Step 5: 通过 → git commit + changelog（fix-of: [fb_001, fb_005, ...]）
            不通过 → 回滚 / 调整 / **K 轮计数 +1**
```

##### Bounded Budget（撞墙强制升级）

**K 轮硬上限**（建议 K=3）：同一层物料连续 K 次 bump 后 holdout 仍无改进 → **禁止继续改该层**，必须升级到下一层（[`不变量 #16`](03-invariants.md#16-bounded-budget)）。

##### L0–L5 升级路径（代价递增）

```
L0  改 prompt 措辞           ← 最便宜，先试
L1  加 / 改 exemplar (few-shot)
L2  改 rubric 维度 / anchor
L3  改 schema（输出结构）
L4  拆节点（任务太大，单节点搞不定，重新切节点边界）
L5  重新定义任务            ← 最贵但最诚实
                            （承认 "LLM 可能根本不该干这事"
                             或当前模型能力不够）
```

撞 Bounded Budget 不是放弃，是**承认这一层不够，必须往上爬**。死磕 L0 = "完美的过拟合" + 业务永远等不到。

##### 一次过率分诊（决定从哪一层开始）

| 一次过率（train） | 诊断 | 起手动作 |
|---|---|---|
| 0% | 物料方向完全错 | **停！不要改 prompt**。重新审视任务边界，可能直接跳 L4/L5 |
| 10–40% | 物料对了基础但关键路径错 | 失败聚类找 top 1 类问题 → 改对应层（多半 L1/L2） |
| 40–80% | 多个并列失败 | 每次只改一个最高频类，**禁止一次改多个**（不然分不清是哪改有效） |
| 80–95% | 长尾问题 | 看 attribution——零散随机 → 标 `single-case`，不改全局物料 |
| 95%+ | 收敛 | 停止迭代，转新维度（加 case / 换节点） |

##### 每类物料的"必须关联"

| 物料类型 | bump 时必须配套 |
|---|---|
| prompts | train regression case 集 + holdout 不退化验证 |
| rubrics | anchor + 反例必须是**真实样本**，不能凭空编 |
| schemas | migration 脚本 + 老数据回放测试（旧 artifact 仍可被读） |
| style_guides | 同 prompts |
| exemplars | 每条 exemplar 是真实样本片段（不允许合成数据） |

##### v1.0 bootstrap 例外

v1.0 不要求 regression set 与 holdout（鸡生蛋）。但一旦投产，跑出的第一批 artifact + 人工抽样**强制成为 regression seed 并按 70/30 分配到 train / holdout**——v1.0 不是"好"，是"基线"（[`不变量 #12`](03-invariants.md#12-v10-物料-bootstrap-例外v1xx--1-必须配套-regression-set--diff-通过才上线)）。

> **用户操作手册**：本节是机制定义。日常怎么走 L0–L5、撞墙怎么办、看到什么数据该做什么，见 [`04-handbook.md`](./04-handbook.md)。

#### 2.2.3 规则起源分类与 tag 体系（物料入口约束）

**问题**：每加一条规则到物料前，必须回答**这条规则该不该长期持有**——不分类的后果是物料越积越厚，**模型升级后老 scaffolding 还在叠加效果，反而拖累新模型**。

**核心判断（一句话）**：

> 这条规则要解决的问题，对模型供应商而言是不是"普适的"？  
> **所有调用方都希望模型这样做** → 在模型迭代路线上 → 12–18 个月内会被模型自身解决  
> **只有你或你这个行业才在意** → 业务侧永久负担 → 必须长期版本化维护

##### 四个判断测试

| 测试 | 问什么 | 例子 | 处置 |
|---|---|---|---|
| **普适性测试** | 所有 LLM 调用方都会撞到 / 抱怨吗？ | 减少幻觉 / JSON 合规 / 指令跟随 / 避免重复 / 文本流畅 / 压制 `delve` `in conclusion` 等 LLM 印迹 / 长度控制 / 基本推理正确性 | **不要堆复杂 FSM 或长 example**——模型代际会解决；scaffolding 12–18 个月内变包袱 |
| **私有信息测试** | 规则是否依赖只有你这边知道的信息？ | 品牌 tone / 内部术语表 / 产品名映射 / 合规条款 / 客户分层 / SEO 关键词 / 渠道字段（推文 280 字 / 邮件主题行 / CMS schema） | **模型永远学不到**，业务侧必须长期维护 |
| **趋势测试**（最实证） | 同一 prompt 在最近 2–3 代模型上盲测，行为变了吗？ | "请用列表回答" 老模型常忘 / 新模型稳定遵守 → 老 prompt 里那句加固可删 | **明显变好 = 等模型**；**几乎没变 = 业务永久** |
| **后果不对称测试** | 即使模型能做对，出错代价能承受吗？ | 监管 / 法律 / 品牌红线 / 安全敏感词 | "模型大概率能做对" ≠ 愿意把这件事交给概率分布——**仍在应用层做显式校验** |

##### 物理隔离两层（强约束）

物料目录在节点级（[ADR-019](ADRs/019.md)），但**节点内部必须再分两层物理隔离**（[`不变量 #12b`](03-invariants.md#12b-物料分两层物理隔离)）：

```
nodes/<name>/
├── prompts/
│   ├── _model_adapter/        ← 模型适配层（易耗品，假设要被重写）
│   │   ├── format_validator.md     防 JSON 不合规
│   │   ├── style_repair.md         压 LLM 印迹
│   │   ├── retry_directive.md      指令跟随加固
│   │   └── ...
│   └── _business_rules/       ← 业务规则层（长期资产，做版本管理 + 单测）
│       ├── brand_voice.md          品牌 tone
│       ├── terminology.md          内部术语
│       ├── compliance.md           合规条款
│       ├── channel_constraint.md   渠道字段
│       └── ...
├── rubrics/   (同样分两层)
└── ...
```

**两层完全不混**：
- 模型适配层 = 改 prompt 模板 / retry 配置 / format validator——**写完就准备删**
- 业务规则层 = 品牌词表 / 合规 / taxonomy / channel adapter——**跟产品 owner 一起 review**

##### 强制 tag（CI 校验）

每条规则必须打 4 选 1 的 tag（[`不变量 #12a`](03-invariants.md#12a-每条规则必须打-4-选-1-的-tag)）：

| Tag | 含义 | 处置 |
|---|---|---|
| `capability_gap` | 模型能力不足的临时补丁 | **每次模型升级强制重跑回归**，符合预期立刻删 |
| `business_policy` | 业务规则 / 品牌 / 合规 / 私有信息 | 长期持有，版本化 + 单测 |
| `channel_constraint` | 渠道/格式约束（字符上限、schema） | 长期持有，跟外部接口同步 |
| `integration_glue` | 系统集成胶水（schema 转换、字段映射） | 长期持有，跟集成方一起 review |

物料文件头**强制声明** tag，缺失 CI 拒绝合并：

```yaml
# materials/prompts/<node>/_model_adapter/format_validator.md
version: 1.0
tag: capability_gap                  # 必填，4 选 1
created_at: 2026-05-12
expected_obsolete_by: "next-major-model-release"
trend_test_log:                      # 趋势测试痕迹
  - model: claude-haiku-4.5    pass_rate_without_rule: 60%
  - model: claude-sonnet-4.6   pass_rate_without_rule: 92%   # 已稳，准备删
```

##### 升级期强制重跑

模型升级（如 Sonnet 4.6 → 5.0）后（[`不变量 #12c`](03-invariants.md#12c-模型升级后强制重跑所有-capability_gap-规则的无该规则对照)）：

```
CI 自动触发：
  for rule in materials.where(tag == "capability_gap"):
      跑无该规则的 prompt vs 当前 prompt
      若新模型在无规则版本已 ≥ baseline → 标记 rule 为 obsolete_candidate
      人工 review → 删 / 保留 / 降级 tag
```

**90% 的"框架老化"是 capability_gap 没及时清理**——这是不变量级强约束。

##### 灰区：brand voice 类

部分需求既是"普遍写作能力"（模型在变好）**又**涉及"私有偏好"（永远学不到）。例：

> "我们品牌的语气是技术幽默 + 自嘲"

不会被模型完全替代，但会从"重 prompt + 重后处理" 逐步迁移到 "轻 prompt + few-shot / fine-tune"。**留专门升级路径，不简单二分**：

```
Stage 1（现在）：重 prompt + style_repair post-processing
Stage 2：少量 few-shot exemplars 替代 style_repair
Stage 3：fine-tune 模型，prompt 退化为薄指令
```

每条 brand voice 规则在 metadata 标注 `evolution_stage: 1/2/3`，跟着模型代际迁移。

### 2.3 Eval Stack（仅框架自动能力）

**职责**：给每个 Node 提供"自动判优劣 + 可解释"的能力。**只包含框架内核能交付的自动评估能力**；人工评审治理实践不属于本模块（见 §2a）。

四档框架自动能力：

| 档位 | 用途 | MVP 必备 |
|---|---|---|
| Schema check | Pydantic 结构合规 | 是 |
| LLM-as-judge **with attribution** | 内容打分（rubric 维度）+ 每条 pass/fail 引用具体规则段落 + 触发的 anchor + LLM thinking 摘要 | 是 |
| Auto-judge Runner | 跑批后自动跑完全量 rubric × case，无需手动触发；输出聚合报告 | 是 |
| Regression diff | 物料 promote 前对 frozen set 跑新旧对比 | 否（MVP 走最薄闭环即可） |

**Attribution 强制要求**（关键能力，对应阶段 3 痛点 B，见 [`不变量 #3`](03-invariants.md#3-每条-rubric-维度-passfail-必须输出-attribution)）：

```yaml
# 每条 rubric 维度 judge 结果必须长这样
dimension: "style_fidelity"
verdict: fail
attribution:
  violated_rule_ref: "materials/prompts/plan/v1.0.md#L34-L38"   # 物料文件 + 行号
  violated_anchor:   "rubrics/plan/v1.0.yaml#anchor_style_3"    # 命中的 anchor id
  citation_in_artifact: "shots[2].text:L5"                       # artifact 内的违反位置
  judge_thinking: "shot 2 的措辞用了'其实'（口语标记），违反 style 规则 #3 ..."
```

没有 attribution 的 judge 输出 = 黑盒 = MVP 不通过（[`不变量 #3`](03-invariants.md#3-每条-rubric-维度-passfail-必须输出-attribution)）。

**Judge 模型规则**（[ADR-006](ADRs/006.md)）：judge ≥ generator 同代；**同节点同模型**，跨模型 judging 反而增方差（[`不变量 #5`](03-invariants.md#5-judge-模型--generator-同代)）。

**Rubric 物料**：5–7 维 / 0/5/10 **anchor（标杆例子：0 分长什么样 / 5 分长什么样 / 10 分长什么样，给评审 / judge 对照用，不靠脑里的标准）** / 反例集——schema 约定在 **Materials Registry**（§2.2），不在本模块。

**Gold set / Regression set 资产化**：放在 `eval/<node>/regression/`，frozen，git 管理。第一版 ≥ 1 个 case 起步即可（MVP），业务侧再扩到 20–30。

**Correlation check** 工具：框架提供 CLI（`s2v eval correlate`），但触发条件 / 解读 / 阈值校准都是治理实践——见 §2a。

### 2.4 Observability

**职责**：让"系统在干什么 + 凭啥这么干"始终可见。两层目标——传统 LLM call trace + **Decision Trace（白盒化证据链）**。

**信号采集**：

| 信号 | 来源 | 落点 |
|---|---|---|
| LLM call (prompt / output / token / latency) | OpenAI SDK wrapper（走 OpenAI 兼容端点） | Langfuse |
| 节点执行 trace | Runtime | Langfuse |
| **Decision Trace**：渲染前后 prompt diff / 命中的 exemplar / 用到的 style 段落 / LLM thinking | Runtime + Materials Registry | Langfuse + `traces/decisions/` |
| **Eval Attribution**：每条 rubric 维度的 violated_rule_ref / anchor / citation | Eval Stack（见 §2.3） | Langfuse + `traces/eval/` |
| 人工 diff (原始输出 vs 最终采纳) | Per-Node Console / CLI | `traces/diffs/` |
| Shadow autonomy rate | 派生自 diff | `metrics/<node>.parquet` |

**Decision Trace 字段**（关键，对应阶段 3 痛点 B，见 [`不变量 #4`](03-invariants.md#4-每次-llm-call-必须有-decision-trace)）：

```yaml
# 每次 LLM call 除了 prompt/output，还要落
decision_trace:
  prompt_template_id: "plan/step3@v1.4"
  rendered_prompt_diff: <模板渲染前后 diff>      # 看到了哪些变量被填进去
  materials_injected:
    style_guide: "series/ml_course/style@v1.2#L10-L20"   # 注入了哪段
    terminology: "series/ml_course/term@v1.1"
  exemplars_used:
    - id: "ex_034"  reason: "few-shot similarity match"
  llm_thinking_summary: "I focused on hook → setup arc because target_duration=600s ..."
```

**批量 runner**：`s2v run <node> --cases <set> --materials <revspec>`——支持矩阵执行 + 自动跑 Eval 全量。

### 2.5 Feedback Loop

**职责**：把人工反馈从"自由文本评论"变成"可聚类、可归因、可触发物料升级"的结构化流。

**反馈 schema（强制，见 [`不变量 #7`](03-invariants.md#7-反馈强制结构化-schema含-likely_cause)）**：

```yaml
feedback_id: fb_2026_05_12_001
artifact_id: ml_linreg_ch01_plan
location: "shots[2].intent"
issue: "intent 标为 recap，实际内容是引入新概念"
expected: "应该是 setup"
likely_cause: "模型把'承接前文'误判为'回顾'"   # ← 归因聚类的命根子
severity: medium
reviewer: alice
```

**工作流**：收集 → 不即时改 → 反馈队列达阈值 N（建议 N=3，见 [`不变量 #15`](03-invariants.md#15-反馈聚类阈值)）触发 triage 聚类 → 归因到 5 层（style / prompt / schema / rubric / exemplar / single-case）→ baseline → 改物料 → regression → 版本 bump + changelog。

### 2.6 Per-Node Console

**职责**：给每个 Node 一份独立的 review/rerun 界面。**禁止聚合视图**（[`不变量 #8`](03-invariants.md#8-per-node-console-禁止聚合视图跨节点靠-artifact_id-跳)）——管理界面同节点粒度，否则在 UI 层重新引入耦合。

**真正的设计动机**：**Per-Node Console 是作者本人的"项目活体地图"**，不是协作工具、不是新人 onboarding 工具。

> 没有 console = 节点的设计 + 物料 + 当前指标 + 反馈情况都散在文件系统里。**几周不碰，作者对项目的理解就会冷却 → 重新启动靠考古文档 / 代码**。  
> console = 一屏看完，活体感知。是认知负担的减压器，不是协作便利的糖。

**单页 Streamlit 内容**：
- Artifact 结构化渲染（不是裸 JSON）
- 物料版本徽章（prompt vX / rubric vY / schema vZ / style / exemplars）
- **Eval Attribution**（每条 rubric pass/fail + violated_rule_ref + judge_thinking）
- **Decision Trace**（rendered prompt diff / 注入物料 / 命中 exemplar / LLM thinking 摘要）
- 字段旁结构化反馈按钮（弹出 §2.5 反馈表单，预填 location）
- rerun 按钮（"换物料版本对比跑"选项）
- 节点最近指标：一次过率 / Budget 当前层 + 剩余轮数 / 平均 cost

**跨节点导航**：纯 artifact_id 超链接跳转。**禁止全流程聚合页**。

**完整 UI spec + ASCII 原型图**：见 [`06-ui-spec.md`](./06-ui-spec.md)。

**3 层 UI 架构补充**（[ADR-025](./ADRs/025.md)、[ADR-027](./ADRs/027.md)、[ADR-028](./ADRs/028.md)）：本节描述的 Per-Node Console 是 **L3 框架层**。其上还有 L2（Hub Console，作者运维入口）和 **L1（Business Console，业务层使用者入口）**——L1 跟框架解耦；当前主线以 Writing Job 为单元，Episode / 讲解文档包作为默认 Output Profile 的查看单元保留，**不进框架内核抽象**。L1 当前 SOT 见 [`business-console.md`](./business-console.md)。

#### 2.6.1 节点级文档与代码目录（与 Console 同构）

**铁律**：节点拥有自己的一切——代码、物料、UI、文档、eval——**统统住在同一个目录**。[`不变量 #8`](03-invariants.md#8-per-node-console-禁止聚合视图跨节点靠-artifact_id-跳) 在 UI 层不够，必须延伸到**文件系统层**（[ADR-019](ADRs/019.md)）。

```
nodes/
├── toy/                       ← 框架 MVP 唯一节点
│   ├── README.md              这节点是什么、IO、当前物料版本
│   ├── node.py                Node 实现（Python class）
│   ├── prompts/               ← 物料就近放（不集中到 fixtures/materials/）
│   ├── rubrics/
│   ├── schemas/
│   ├── style_guides/          (可省)
│   ├── exemplars/             (可省)
│   ├── eval/                  这节点的 regression set
│   └── ui/                    这节点的 Streamlit 页（100–200 行）
└── (业务侧第二轮)
    plan/、shot/、qa/          ← 每个独立同构，无共享代码
index.md                       ← 全系统索引：只列节点和连接，不重复细节
```

**为什么物料从 `fixtures/materials/<node>/` 搬到 `nodes/<name>/{prompts,rubrics,...}/`**：

| 集中存放（旧） | 节点就近（新） |
|---|---|
| `fixtures/materials/toy/v1.0/prompts/extract.md` | `nodes/toy/prompts/extract.md` |
| 物料、代码、UI、eval 分散在 4 个顶层目录 | 全在 `nodes/toy/` 一个目录 |
| 改节点要跳 4 处 | 改节点只在一个目录里 |
| 新人接节点要看 4 处 | 看一个目录就齐 |
| **耦合在文件树拓扑里隐藏** | **解耦在文件树拓扑里显式** |

**`index.md` 内容**：

```markdown
# source2video 系统索引

## 节点（按调用顺序）
- [toy](./nodes/toy/) — 框架 MVP 唯一节点（MarkdownPointsExtractor）

(业务侧第二轮)
- [plan](./nodes/plan/) — 期级 Plan 节点
- [shot](./nodes/shot/) — ShotExecutionNode
- [qa](./nodes/qa/) — 期级一致性校验

## 连接关系
toy: standalone（无上下游）
plan → shot → qa
```

**改某节点不动 index.md**（除非 IO 契约变 / 新增节点 / 删节点）。这才是"局部演化 + 全局可读"。

---

## 2a. 业务侧治理实践（不在框架内核）

> **重要边界**：以下条目曾被混入 Eval Stack 模块图，造成"框架能力 vs 治理实践"的耦合。**本节明确把它们移出框架内核**。框架可以为这些实践提供工具支持（CLI / 存储），但触发条件、人工流程、阈值校准都属于**业务侧第二轮+ 的运营纪律**，不在 MVP 验收范围。

| 实践 | 性质 | 框架是否提供支持 | 何时引入 |
|---|---|---|---|
| 评审校准（盲评 10 例） | 人工评审防漂移 | CLI `s2v eval calibrate`：抽样 + 隐分数 + 落 log；评本身靠人 | 物料 promote 节奏稳定后 |
| 对照样本（混入评审池的 10% 已知差 case） | 防止评审标准漂移——评审给"已知差"高分 = 标准漂了 | 框架支持把 case 标记为 `known_bad: true`；触发与解读由人 | 治理流程要正式化时 |
| 多评审 + 一致性裁定 | 关键决策防单点偏移 | CLI 工具支持双盲收集 + 第三人裁定；评审本身靠人 | 出现 ≥ 2 个评审者时 |
| 相关性校验（judge ↔ 真实质量） | 防 Goodhart 内循环（指标反噬：rubric 被当成目标后失效） | CLI `s2v eval correlate`：算 Pearson/Spearman；解读靠人 | 下游成品累计达阈值 N |
| 评审 rubric 反演 / anchor 重校准 | 治理 rubric 漂移 | 无专门工具，靠 Materials Registry 版本化 | rubric 改动时手动做 |

**MVP 不交付任何治理实践**——这些进入第二轮业务侧 MVP 后才落地（见 [`_future/business-design.md`](./_future/business-design.md) §9 阶段 B-E）。

**为什么单独抽出来**：框架是"通用 LLM workflow 流水线"，**治理实践是业务运营的纪律**，跟"我做哪个业务、产出多少、几个人评审"高度耦合。把它放进框架模块图会：
1. 让读者误以为 MVP 要交付这些
2. 让"框架能力"和"业务实践"混淆，违反 §0 "测框架不测业务"纪律
3. 让模块边界失焦（Eval Stack 该是自动能力，不是治理实践）

---

## 3. 数据流

```
[Case]                                          ┌───────────────────┐
[Materials Registry] ──→  [Node Runtime]  ──→  │  Artifact         │
                              │                 │  (内嵌物料版本号)  │
                              │                 └─────────┬─────────┘
                              │                           │
                              ▼                           ▼
                          [Langfuse]              [Eval Stack]
                          (Trace)                 ├─ schema check
                                                  ├─ LLM judge
                                                  └─ regression diff
                                                            │
                                                            ▼
                                                  [Per-Node Console]
                                                  人工 review + 反馈
                                                            │
                                                            ▼
                                                  [Feedback Loop]
                                                  triage → 归因
                                                            │
                                                            ▼
                                                  [Materials Registry]
                                                  版本 bump + changelog
                                                  → 下一轮跑批
```

---

## 6. MVP 范围

**框架骨架 + ToyNode dogfood + Per-Node Console，并行交付**。**测框架不测业务**——不开发任何真实业务节点（Plan / ShotExecutionNode 等），不评估业务质量指标。后续节奏由 MVP 跑出的真实数据驱动，本文档不预设。

### 框架最薄交付（六模块）

| Module | MVP 交付物 |
|---|---|
| Node Runtime | Node Protocol + 单次 LLM call 包装 + tenacity 重试 + 多步链（Eval-Opt 循环可选） |
| Materials Registry | `nodes/<name>/{prompts,rubrics,schemas,...}/` 就近放 + Pydantic version field + cold reload + **train/holdout 拆分** + **Promote Pipeline 双向 Gate + Bounded Budget**（[`不变量 #12-#16`](03-invariants.md#12-v10-物料-bootstrap-例外v1xx--1-必须配套-regression-set--diff-通过才上线)） |
| Eval Stack | Schema check + LLM-as-judge **with attribution**（必备）+ Auto-judge Runner（跑批后自动跑完全量 rubric） |
| Observability | Langfuse 自托管 + 所有 LLM call 走 trace + **Decision Trace** 字段 + Eval Attribution 落 `traces/eval/` |
| Feedback Loop | 结构化反馈 schema（含 `likely_cause`）+ `nodes/<name>/feedback/*.yaml` 入 git + **≥ N 条同因聚类才触发改物料**（[`不变量 #15`](03-invariants.md#15-反馈聚类阈值)）+ 不接自动 triage |
| Per-Node Console | **ToyNode Streamlit 单页 ≤ 200 行**：artifact / 物料 / Eval Attribution / Decision Trace / 反馈表单 / rerun / 节点指标（六件一屏）。规格见 [`06-ui-spec.md`](./06-ui-spec.md) |

### dogfood 节点：**ToyNode（人造，非业务）**

- 任务："MarkdownPointsExtractor"——抽取 N 个要点 + 给每个要点打分
- 物料：5 类齐（prompts + judge + rubric + schema + style + exemplars）
- 跑 `fixtures/cases/train/` 的 5 个 synthetic case + 3 个负例
- **不做**：Plan 节点 / ShotExecutionNode / 任何业务节点开发（第二轮见 [`_future/business-design.md`](./_future/business-design.md)）

### MVP 出口判据

**完整 AC + 出口判据见 [`07-acceptance.md`](./07-acceptance.md) §5（8 条全部框架能力，零业务指标）**。本文档不重复，简记如下：

1. L1 + L2 + L3 测试全绿
2. L4 ToyNode dogfood 在 `cases/round1/` ≥3 个 case 上跑通
3. Langfuse trace 完整 + Decision Trace 完整（≤3 跳追完证据链）
4. Eval Attribution 完整（缺字段判失败）
5. Auto-judge 全量跑通
6. **ToyNode Console 上线**
7. 反馈 → 改物料 → regression → bump 闭环跑通
8. 物料版本复现性（老 artifact 可重跑）

> **没有"业务质量指标"**：plan 一次过率、可执行率、rule_audit 结论 = 全部业务测试，第二轮的事。

---

## 7. 与现有文档的关系

| 文档 | 在新架构里的角色 |
|---|---|
| `02-architecture.md`（本文） | **框架本体**，最高优先级。冲突以本文档为准 |
| [`03-invariants.md`](./03-invariants.md) | **不变量墙**：16 主 + 3 子，从本文档 + ADR 沉淀。违反即视为框架损坏 |
| [`business-console.md`](./business-console.md) | **当前 L1 业务产品原型 SOT**：Writing Job 工作台、候选评审、反馈账本、规则快照、定稿导出 |
| [`07-acceptance.md`](./07-acceptance.md) | **验收基线**：业务产品原型验收 + framework ToyNode 历史基线 |
| [`_future/business-design.md`](./_future/business-design.md) | **业务案例：PPT→视频**。降级为"第一个 dogfood 实例"，业务节点（Plan / ShotExecutionNode）的需求来源；当前不作为主线 |
| [`ADRs/`](./ADRs/) | **决策记录**。其中 ADR-001/003/004/008/009/010 已升级为框架不变量；ADR-002/005/006/007 仍适用于业务节点选型 |
| [`01-quickstart.md`](./01-quickstart.md) | 启动 6 步（原 `04-handbook.md` §2.0.5） |
| [`04-handbook.md`](./04-handbook.md) | 日常操作手册主体（L0–L5 撞墙、反馈、双向 Gate 验证） |
| [`reference/cli.md`](./reference/cli.md) | CLI 速查（原 `04-handbook.md` §7） |
| [`06-ui-spec.md`](./06-ui-spec.md) | L2/L3 诊断层 Console UI spec + ASCII 原型 |
| [`08-tech-stack.md`](./08-tech-stack.md) | 技术栈清单 + 包版本 + `.env.example` + `pyproject.toml` 草稿 |
| [`_future/user-stories.md`](./_future/user-stories.md) | 第二轮业务侧 US |
| [`_future/test-cases.md`](./_future/test-cases.md) | 第二轮业务侧 TC |
| [`../../docs/repo-layout.md`](../../docs/repo-layout.md) | 仓级 4 层 DAG / 跨仓边界 |
| [`../../docs/ADRs/023.md`](../../docs/ADRs/023.md)、[`../../docs/ADRs/024.md`](../../docs/ADRs/024.md) | 仓级 ADR（抽离时机 / DAG 性质） |

**下一份要新增**：`nodes/plan/README.md`（业务节点级文档，per-node 责任绑定）。本架构定型后再写。

---

## 8. 未决问题（Open）

1. **Materials Registry hot reload**：第一版用 cold reload（每次执行从 git 读最新版）够不够？还是要做 in-process cache + watcher？
2. **Trace 与 Artifact 的关系**：trace 是否要内嵌 artifact 引用，还是独立存储靠 Langfuse 关联？
3. **Cost 控制**：第一版要不要做 budget guard（单次执行 token 上限）？还是先纯放任 + 监控？
4. **Per-Node Console 部署形态**：每节点一个独立 Streamlit 进程，还是单进程多 page？
5. **Case 集合的版本化**：cases 本身要不要 frozen？（regression 集已经 frozen，但日常跑批的 case 集呢？）

这 5 个问题等第一版跑起来撞到再决定，不要预先决策。
