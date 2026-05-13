# 07 · source2video 验收与测试方案

> **阅读位置**：07 / 10（入口：[`README.md`](./README.md)）。**本文档定位**：框架 MVP 用户故事 + 验收标准 + 测试方案。
>
> 配套：[`02-architecture.md`](./02-architecture.md)（框架本体）、[`_future/business-design.md`](./_future/business-design.md)（业务案例：PPT→视频，第二轮才动）、[`00-glossary.md`](./00-glossary.md)（术语索引）。
>
> **节奏纪律**：所有验收按"轮次/能力/通过判据"组织，不按时间排期。

---

## 0. 第一轮纪律：**测框架，不测业务**

**MVP 验收只验"框架能力是否齐备"**。**不在 MVP 范围内的**：

- 任何真实业务节点（Plan / ShotExecutionNode / TTS / 视频合成 ...）
- 业务质量判断（plan 一次过率、rule_audit 结论、可执行率）
- 反推老项目已有期次的 plan / gold set

**MVP 唯一允许的节点**：一个**人造 ToyNode**——它的存在目的就是把框架所有 module 撑满走通，没有任何业务意图。详见 US-09。

### 真实痛点 → 框架能力的硬绑定

老项目 `ai-engineer-roadmap` 现状：**全 ML 系列 50+ 期已跑完，02-DL 在跑中**。痛点三件套（评估容量崩溃 / 黑盒化 / 迭代爆炸，详见 [`02-architecture.md`](./02-architecture.md) §0）决定了 MVP 必须满足：

| 验 | 不验 |
|---|---|
| 框架能批量跑 N 个 case 不挂 | ToyNode / 任何真实节点的产出质量 |
| **每条 rubric 维度 pass/fail 可追溯到具体规则段落 + LLM thinking**（解黑盒） | 老规则到底准不准 |
| **每次 LLM call 有 Decision Trace**（rendered prompt diff / materials / exemplars / thinking） | 哪条 rubric 命中合理 |
| **LLM-as-judge 全自动跑完全量 rubric，无需人工逐条评**（解评估容量） | 业务质量结论 |
| 物料改动能复现 + 能回滚 | — |
| 反馈→改物料→regression→bump 端到端跑通一次 | — |

业务节点（Plan / ShotExecutionNode 等）的开发与验收 = **第二轮**专门处理，本文档不涉及。

---

## 1. 角色与价值流

**第一版只有 1 个真实 user**：开发者本人。但他用 source2video 时只扮演**一个角色**：

| 角色 | 关心什么 |
|---|---|
| **框架用户** (Framework User, FU) | API 稳定、可批量、可观测、物料可改可回滚、反馈链路通 |

业务用户（BU）视角在第二轮才引入。第一轮所有 user story 都是 FU 视角。

**价值流（框架视角）**：

```
任意 case （任何 markdown 文本输入）
  │
  ▼
[ToyNode]  ←──── 物料 (prompts/rubrics/schemas)
  │                  ▲
  ▼                  │
Artifact (内嵌物料版本)
  │                  │
  ▼                  │
[Trace + Metrics] →  │
                     │
[Structured Feedback] → triage → 改物料 → bump 版本 → 回归对比
```

**框架要让上面这条链跑通一次，不评估每个环节的业务质量**。

---

## 2. User Stories（速览）

> 详细 AC 见 [`_future/user-stories.md`](./_future/user-stories.md)。本节只列速查表 + 优先级。

| 编号 | 标题 | 优先级 |
|---|---|---|
| US-01 | 批量跑测试 | P0 |
| US-02 | 人工修改初始规则 | P0 |
| US-03 | 物料版本可回滚与可复现 | P0 |
| US-04 | 每次 LLM call 白盒化可观测 | P0 |
| US-05 | 节点级 metrics 聚合 | P0 |
| US-06 | Synthetic 测试用例 + CI 集成 | P0 |
| US-07 | 人工反馈结构化入库 | P0 |
| US-08 | 反馈 → 物料升级 → regression 端到端 | P0 |
| US-09 | ToyNode 跑通 dogfood | P0 |
| US-10 | 规则遵守可追溯 / Eval Attribution | P0 |
| US-11 | 评估容量放大 / Auto-Judge at Scale | P0 |
| US-12 | ToyNode Console（节点级 review UI） | P0 |
| US-13 | 业务质量验收（一次过率 / rule_audit / 可执行率） | P2 |
| US-14 | 评审校准 / 对照样本 / 相关性校验 | P2 |

**P0 = 11 条，全部进 MVP**；P1 / P2 暂无 P1 条目，P2 共 2 条延后到第二轮。

---

## 3. 测试用例与 Fixtures（框架回归测试）

### 3.1 设计原则

| # | 原则 | 含义 |
|---|---|---|
| 1 | **全 synthetic，零业务数据** | 不喂任何 ai-engineer-roadmap 真实文本，避免框架 bug 与业务 bug 混淆 |
| 2 | **覆盖边界条件** | 极短 / 极长 / 含代码 / 含 Unicode / schema 异常等故意 stress |
| 3 | **frozen 不可变** | `fixtures/` 是 git frozen 资产；改动必须 changelog + PR |
| 4 | **服务框架回归** | fixtures 唯一用途是框架自身回归测试，不作业务质量度量 |
| 5 | **业务无关 ToyNode** | 物料 / 任务 = "抽取要点 + 打分"，跟讲解视频毫无关系 |

### 3.2 Fixture 目录结构（节点就近放，与 [`02-architecture.md` §2.6.1](./02-architecture.md) 同构）

**铁律**：物料 / 代码 / UI / eval **全住在节点目录**。`fixtures/` 只保留**跨节点共享的输入数据**（cases 和 regression）。

```
nodes/
└── toy/                                  # ToyNode 的所有东西就近放
    ├── README.md                         这节点是什么、IO
    ├── node.py                           Node 实现
    ├── prompts/{extract.md, judge.md}
    ├── rubrics/toy.yaml                  3 维 rubric (clarity / coverage / format)
    ├── schemas/toy_artifact.py
    ├── style_guides/toy_voice.yaml       (可省)
    ├── exemplars/{ex_01.yaml, ex_02.yaml}（bootstrap 建议 ≥1）
    ├── eval/regression/                  这节点的 regression set 种子
    └── ui/                               这节点的 L3 console（Next.js page，一屏视觉密度；[ADR-026](ADRs/026.md)）

fixtures/                                 # 仅跨节点共享的输入数据
├── cases/                                # case 集（按 split 分）
│   ├── train/
│   │   ├── 01_basic.md + 01_basic.metadata.yaml
│   │   ├── 02_short.md + 02_short.metadata.yaml
│   │   ├── 03_long.md  + 03_long.metadata.yaml
│   │   ├── 04_with_code.md + ...
│   │   └── 05_unicode.md + ...
│   ├── holdout/                          # frozen，物料迭代期禁止访问
│   │   └── (auto-allocated via register)
│   └── manifest.yaml                     # 全量 case 索引 + sha256 + split
└── regression/
    └── v1/
        ├── baseline_v1.0.json         # 用 v1.0 物料跑 cases/ 的 frozen 基线
        └── manifest.yaml              # 跑批配置 + git revspec
```

### 3.3 测试用例（速览）

> 详细设计表 + 用例内容详述见 [`_future/test-cases.md`](./_future/test-cases.md)。本节只列概要。

| Case ID | 设计意图 | 关联 US |
|---|---|---|
| **TC-01** | baseline：普通段落 + 列表，无边界压力 | US-09, US-10 |
| **TC-02** | 极短输入（≤50 字），信息密度低 | US-09, US-11 |
| **TC-03** | 极长输入（≥3000 字），要点收敛 | US-09, US-11 |
| **TC-04** | 含 fenced code block + inline code | US-09 |
| **TC-05** | 中英 + emoji + 数学符号 + 全角标点 | US-09 |
| **TC-NEG-01** | 物料缺 version 字段 → 启动报错 | US-02 |
| **TC-NEG-02** | judge 缺 attribution 字段 → 该次判失败 | US-10 |
| **TC-NEG-03** | LLM 返回不合 schema → retry 后入失败队列 | US-09 |

**通过判据**：8 个 case 全部跑通 + attribution 完整 + 框架不挂。

### 3.5 回归基线（Regression）

**机制**：`fixtures/regression/v1/baseline_v1.0.json` 是用 `materials/toy/v1.0` + `cases/` 跑出的产物快照。

**用途**：

1. **物料 bump 时的 baseline**——任何 `materials/toy/v1.x` 改动必须先跑 `s2v eval regression --baseline v1.0`，diff 通过才能合并（对应 [`02-architecture.md`](./02-architecture.md) §2.2.2 Promote Pipeline + [不变量 #12](./03-invariants.md)）
2. **代码回归时的 baseline**——任何 Runtime / Eval Stack / Observability 代码改动跑同一命令，行为差异必须解释

**Diff 通过判据**：

- ✅ 所有 case 仍能跑出 artifact（无新增 crash）
- ✅ schema 合规率不下降
- ✅ rubric 每个维度的 pass 数 ≥ baseline（attribution 维度允许内容 diff，但 verdict 分布不退化）
- ❌ 任何 case 由 pass 变 fail → 必须解释（要么是 fix，要么回滚）

**更新 baseline 的流程**：

```
当 baseline 需要更新时（例如有意改动 rubric 标准）：
1. 在 PR 描述里说明为什么旧 baseline 不再适用
2. 跑 s2v eval regression --update-baseline
3. baseline 新文件 + 旧 baseline 删除 一起入 commit
4. CHANGELOG 标注 baseline_v1.0 → baseline_v1.1
5. PR review 必须双人确认（关键 artifact，不可单点更新）
```

### 3.6 CI 集成

**目标**：fixtures + 测试分层 100% 接入 CI；任何 PR 不绿不能合。

**CI Pipeline**：

```
┌──────────────────────────────────────────────────────────────┐
│  PR 触发（每次 push）                                          │
│  ┌─ L1 Smoke ──┐                                              │
│  │ pytest -m smoke                                            │
│  │ 不调用 LLM，仅启动 + load fixtures + Pydantic 校验          │
│  │ ≤ 30s                                                      │
│  └────────────┘                                               │
│                                                               │
│  ┌─ L2 Unit ──┐                                               │
│  │ pytest -m unit                                             │
│  │ 各 module 契约测试，mock LLM                                │
│  │ ≤ 2min                                                     │
│  └───────────┘                                                │
│                                                               │
│  ┌─ L3 Integration ──┐                                        │
│  │ pytest -m integration                                      │
│  │ 真实 LLM call（Haiku），跑 TC-01 + TC-NEG-* 全部           │
│  │ Langfuse 写入校验、tenacity retry 校验                     │
│  │ ≤ 8min（受 LLM latency 限制）                              │
│  └───────────────────┘                                        │
│                                                               │
│  ┌─ Regression Diff ─┐                                        │
│  │ s2v eval regression --baseline v1.0 --fail-on-diff         │
│  │ 物料 / 代码改动后必跑                                       │
│  └───────────────────┘                                        │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  main 推送 / nightly（不阻塞 PR）                             │
│  ┌─ L4 Framework Dogfood ──┐                                 │
│  │ s2v run toy --cases fixtures/cases/ --concurrency 4       │
│  │ 真实 LLM call（Sonnet 4.6），跑全部 TC-01 ~ TC-05         │
│  │ 输出 reports/dogfood_<run_id>.md                          │
│  │ 失败发通知，不阻塞 main                                    │
│  └─────────────────────────┘                                 │
└──────────────────────────────────────────────────────────────┘
```

**CI 失败矩阵**：

| 信号 | 含义 | 处置 |
|---|---|---|
| L1 / L2 红 | 代码层 / 契约层 bug | 阻塞合并，必须修 |
| L3 红 | 集成 bug 或 LLM 端点异常 | 阻塞合并；若是端点异常，重跑；持续异常→标 known issue |
| Regression Diff 红 | 物料 / 代码改动引起行为退化 | 阻塞合并；解释 + 修 / 回滚 / 更新 baseline |
| L4 红（nightly） | 全量 dogfood 失败 | 不阻塞 main，但发通知 + 查 Decision Trace |

**模型选择（成本控制）**：

| 层 | 模型 | 单次 PR 预估 cost |
|---|---|---|
| L3 Integration | Haiku 4.5 | ≤ $0.10 |
| L4 Dogfood | Sonnet 4.6 | ≤ $1.00 |

**Secrets / 鉴权**：CI 用独立 API key（带预算上限），不复用本地开发 key。

### 3.7 Fixture 工作量原则

- fixtures 是**一次性写好就 frozen** 的资产，改动罕见
- ToyNode 物料 v1.0 = bootstrap，**不进 Promote Pipeline**（架构 §2.2.2 例外）
- case 数量精简：5 个 cases + 3 个负例 = 已覆盖框架 90% 的能力面，**不必扩**
- 真实业务数据 / 反推 plan / 业务 gold set 全部**不在本范围**——业务侧第二轮（见 [`_future/business-design.md`](./_future/business-design.md) §10a）

---

## 4. 测试分层

| 层 | 范围 | 用什么 | CI 触发 |
|---|---|---|---|
| **L1 · Smoke** | 框架能启动、能 load fixtures、Pydantic 校验通过 | pytest -m smoke，无 LLM call | 每次 PR push（≤ 30s） |
| **L2 · Unit** | 各 module 契约（Node Protocol / Materials loader / Artifact schema / Feedback schema） | pytest -m unit + mock LLM | 每次 PR push（≤ 2min） |
| **L3 · Integration** | 跨 module e2e：US-01 / US-04 / US-07 / US-08 / US-10 / US-11 完整路径；跑 TC-01 + TC-NEG-* | pytest -m integration + 真实 Langfuse + 真实 LLM call（Haiku 4.5） | 每次 PR push（≤ 8min） |
| **L4 · Framework Dogfood** | 跑全部 TC-01 ~ TC-05 + Regression diff，只看框架是否完整执行 | `s2v run toy --cases fixtures/cases/` + Sonnet 4.6 | main 推送 / nightly，不阻塞 PR |

**L4 定义**：只验框架完整运行，**不引入任何真实业务节点**。ToyNode 是人造的，输出毫无业务意义。

**详细 CI Pipeline 见 §3.6**。所有触发与失败矩阵在那里。

---

## 5. MVP 出口判定

MVP 验收 = 下列每条都通过：

| # | 判据 | 对应 US |
|---|---|---|
| 1 | L1 + L2 + L3 测试全绿 | US-01 ~ US-08, US-10, US-11 |
| 2 | L4 跑通：ToyNode 在 `cases/round1/` ≥3 个 case 上框架不挂 + artifact 结构合规 | US-09 |
| 3 | Langfuse UI 能查到每次 LLM call，关联到 case + 物料版本快照 | US-04 |
| 4 | **Decision Trace 完整**：抽 ≥3 个 artifact 字段，能 ≤3 跳追到"为啥这么写"完整证据链 | US-04 |
| 5 | **Eval Attribution 完整**：每条 rubric pass/fail 都能追溯到具体规则段落 + LLM thinking；缺失字段则该次执行直接判失败 | US-10 |
| 6 | **Auto-judge 全量跑通**：`s2v run` 后自动跑完所有 rubric × 所有 case，无需手动触发，输出 `reports/eval_<run_id>.md` | US-11 |
| 7 | **ToyNode Console 上线**：单页 Next.js（L3，`doc-maker/ui/app/node/toy/page.tsx`）含 artifact / 物料 / eval / 反馈 / rerun / 指标六件，一屏视觉密度（[ADR-026](ADRs/026.md)） | US-12 |
| 8 | 走通一次"反馈 → 改物料 → 跑 regression → 看 diff → bump 版本" 完整闭环 | US-08 |
| 9 | 物料改动后老 artifact 仍可用历史版本号复现 | US-03 |

**MVP 出口判据里没有的**：
- ❌ plan 一次过率 / 可执行率 → 第二轮业务验收
- ❌ rule_audit 报告结论 → 第二轮业务验收
- ❌ "≥ N% 重合 / ≥ N% 一次过" 这类业务阈值 → 都不要
- ❌ 评审校准 / 对照样本 / 相关性（US-14）

**MVP 跑完会产出的"框架健壮性副产物"**（不进出口判据，但记录到 `reports/dogfood_round1.md`）：

- ToyNode 跑批的失败率分布 + 失败原因聚类（**反映框架健壮性，不反映业务质量**）
- 各物料类型的加载耗时 / 出错率
- LLM call 抖动统计、retry 触发次数、schema 校验失败次数

业务质量（plan 一次过率、rule_audit、可执行率）**不在本轮记录范围**——第二轮启动业务节点开发时才生成相关数据。

---

## 6. 已知风险（框架视角）

| 风险 | 触发条件 | 缓解 |
|---|---|---|
| 老规则文档结构混乱，塞进 ToyNode prompt 难加载 | YAML / Markdown parse 失败 | 先做 schema validator，加载时即时报错；ToyNode prompt 只塞片段不求完整 |
| Langfuse 自托管搭不起来 | docker 部署遇阻 | 临时用 Langfuse cloud 或本地 JSONL trace 替代，不阻塞 MVP |
| KNN 数据装载 schema 设计不通用 | 第二个章节灌不进同一 schema | 第一版只兼容 KNN 已有结构，第二轮拓展兼容性 |
| LLM 反复返回不合 schema 的输出 | Pydantic 校验失败率高 | tool use 强制 JSON + tenacity 重试；超过 N 次仍失败入失败队列，不阻塞框架 |

**注意**：这一节**不列业务风险**——ToyNode 的输出本身无业务意义，没有"质量风险"。

---

## 7. 待用户确认的决策点

| # | 问题 | 我的默认 | 改了什么 |
|---|---|---|---|
| 1 | US-12 (ToyNode Console) 进 MVP 还是延后？ | **进 MVP，P0**（UI 是作者活体地图，没它项目设计在脑里冷却） | 改：从 P1 → P0 |
| 2 | 物料 hot reload vs cold reload？ | cold（每次 `s2v run` 重读 git） | 不变 |
| 3 | L3 集成测试用什么模型？ | **Haiku**（便宜，MVP 测框架不测质量） | — |
| 4 | L4 dogfood 用什么模型？ | **Sonnet 4.6**（中档够用，第一轮跑通框架就行） | — |
| 5 | regression set 起步规模？ | ≥1 case 即可走通 US-08 闭环 | — |
| 6 | KNN plan 反推工作量？ | **不在 MVP 范围**——业务 gold set 是第二轮的事 | — |
| 7 | ToyNode 用什么任务？ | "MarkdownPointsExtractor"——抽要点 + 打分。简单、纯框架能力测试 | — |

模型选择那两条理由是 MVP 既然是测框架，便宜模型反而更适合（能暴露框架重试 / 失败 / schema 校验等机制是否健壮）。CLAUDE.md "不省钱"是写代码场景，**测框架阶段省钱不冲突**。

不爽哪条？
