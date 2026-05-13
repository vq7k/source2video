# source2video 仓内拓扑与图论性质（仓级）

> **阅读位置**：仓级 docs（入口：[`README.md`](./README.md)）。**本文档定位**：仓内物理结构 + 跨仓边界 + 4 层 DAG + 技术架构分层。
>
> 配套：[`ADRs/023.md`](./ADRs/023.md)（单仓多子项目）/ [`ADRs/024.md`](./ADRs/024.md)（4 层 DAG）。
>
> **子项目专属文档见**：[`../doc-maker/docs/`](../doc-maker/docs/)（doc-maker 子项目主流 + ADRs/001~022）。
>
> **冲突优先级**：仓级 ADRs/023 / ADRs/024 > 本文档。

---

## 0. 一图概览

```
═══════════════════════════════════════════════════════════════════
 s2v 仓 = LLM-driven 子系统集中地（单 repo，monorepo 形态）
 「四方拓扑」分工：
   ┌─ s2v ────────────────┐  ┌─ astral-pipeline ──┐
   │ 决策（所有 LLM 节点） │  │ 数据 + 编排        │
   └──────────────────────┘  └────────────────────┘

   ┌─ TTS（外部）─────────┐  ┌─ Remotion（外部）──┐
   │ 音频生成              │  │ 视频渲染           │
   └──────────────────────┘  └────────────────────┘
═══════════════════════════════════════════════════════════════════
```

---

## 1. 仓内物理结构

### 1.1 当前形态（doc-maker 是唯一子项目）

```
s2v/                                  单 repo（monorepo 形态）
├── README.md                         仓级入口 + 子项目列表
├── docs/                             ★ 仓级公共文档（薄）
│   ├── README.md
│   ├── repo-layout.md                ← 本文档
│   └── ADRs/                         仓级 ADR 目录
│       ├── 023.md                    单仓多子项目
│       └── 024.md                    4 层 DAG
│
├── doc-maker/                        ★ 第一个子项目（当前唯一）
│   ├── README.md                     子项目内 README
│   ├── pyproject.toml                子项目独立 pyproject
│   ├── .env.example
│   ├── src/                          子项目当前的"框架内核"代码
│   │   ├── runtime/                  Node Protocol / Runner
│   │   ├── materials/                Registry + train/holdout + Gate + Budget
│   │   ├── eval/                     Eval Stack（with attribution）
│   │   ├── observability/            Decision Trace + Langfuse
│   │   ├── feedback/                 Feedback Loop
│   │   └── pipeline_io/              ← 跨仓契约：读写 astral-pipeline
│   ├── nodes/                        业务节点（ADR-019 就近放）
│   │   ├── toy/                      Phase 0 框架 dogfood
│   │   ├── plan/                     Phase 1 接管"写脚本"
│   │   ├── shot_composer/            Phase 1 产 text/text_tts/notes
│   │   ├── visual/                   Phase 2 接管"visual 决策"
│   │   └── episode_qa/               Phase 3 期级一致性
│   ├── fixtures/cases/               ToyNode synthetic 测试集
│   ├── traces/                       运行时产物（gitignored 大部分）
│   ├── reports/                      跑批报告（gitignored）
│   └── tests/                        L1/L2/L3 测试
│
└── (未来) video-maker/               第二个子项目（撞点才建）
└── (未来) tts-maker/                  TBD（TTS 可优先复用旧 harness）
└── (未来) s2v-core/                   ★ 第二子项目开工时
                                       从 doc-maker/src/ 抽出公共部分
```

### 1.2 命名纪律

`doc-maker/src/` 下的模块（runtime / materials / ...）**命名保持业务无关**——不写 `doc_maker_runtime`，写 `runtime/`。**为未来抽离 `s2v-core/` 留路径**。

ADR-023 强约束：抽离时机 = 第二子项目开工时。**现在不预先抽**。

---

## 2. 跨仓边界（pipeline_io 模块的作用）

### 2.1 四方拓扑

```
═══════════════════════════════════════════════════════════════════
                       ┌───────────────────────┐
                       │   astral-pipeline     │
                       │   数据 + 编排          │
                       │                       │
                       │   episodes/<id>/raw/  │
                       │   ├── doc/            │  ← 数据源
                       │   ├── recording/      │  ← 数据源
                       │   ├── script/         │  ← s2v 写
                       │   ├── visual_spec/    │  ← s2v 写
                       │   └── qa/             │  ← s2v 写
                       └───┬─────────────┬─────┘
                           │             │
                       读：│             │ ↓ 写
                           ▼             ▼
              ┌──────────────────────────────────┐
              │   s2v / doc-maker                │
              │   ├── 节点们                      │
              │   └── pipeline_io 模块            │  ← 跨仓契约
              └──────────────┬───────────────────┘
                             │
              产出文档        ▼ 通过 astral-pipeline 接力
                             │
                  ┌──────────┴──────────┐
                  ▼                     ▼
       ┌──────────────────┐   ┌──────────────────┐
       │  TTS (外部 repo) │   │ Remotion (外部)  │
       │  text_tts → wav  │   │ vspec+wav → mp4  │
       └──────────────────┘   └──────────────────┘
═══════════════════════════════════════════════════════════════════
```

### 2.2 contracts

| 方向 | 路径 | 格式 | 校验 |
|---|---|---|---|
| **读** | `astral-pipeline/episodes/<id>/raw/doc/` | markdown | sha256 / manifest.schema.json |
| **读** | `astral-pipeline/episodes/<id>/raw/recording/` | 媒体文件 | 同上 |
| **写** | `astral-pipeline/episodes/<id>/raw/script/` | JSON | manifest.schema.json + sha256，跟现有 harness 同模式 |
| **写** | `astral-pipeline/episodes/<id>/raw/visual_spec/` | JSON | 同上 |
| **写** | `astral-pipeline/episodes/<id>/raw/qa/` | JSON | 同上 |

### 2.3 pipeline_io 作为独立模块的原因

| 原因 | 落到代码 |
|---|---|
| 跨仓边界必须可单元测试 | `tests/integration/test_pipeline_io.py` 用 mock astral-pipeline 目录 |
| 数据仓演化不冲击决策仓 | astral-pipeline manifest schema 变 → 只改 pipeline_io，不动节点 |
| 替换数据仓容易（如未来换 obj storage） | 改 pipeline_io 一处实现 |
| 节点不直接操作文件系统 | 节点拿 Pydantic 模型，不感知 raw/ 路径 |

---

## 3. 4 层 DAG（图论性质）

### 3.1 4 层结构

```
═══════════════════════════════════════════════════════════════════
 4 层结构 + DAG 性质（详见 ADRs/024.md）
═══════════════════════════════════════════════════════════════════

  L1  s2v 仓
       │ 包含
       ▼
  L2  子项目             doc-maker → tts-maker → video-maker
                         (通过 astral-pipeline 接力)              DAG ✓
       │ 包含                                                      顺序依赖
       ▼
  L3  子项目内的节点      plan → shot×N → qa
                         (ADR-003 不互读，plan 中介)              DAG ✓
       │ 包含                                                      树状 fanout
       ▼
  L4  节点内的步骤        Step 1 → Step 2 → Step 3
                         (Step 2 ∥ Step 3 可并行)                 DAG ✓
                                                                  含并行分支
═══════════════════════════════════════════════════════════════════
```

### 3.2 执行层 vs 演化层

| 层面 | 性质 | 周期 |
|---|---|---|
| **执行层**（单次跑批） | 严格 DAG | 一次 run |
| **演化层**（多次跑批之间） | 循环（反馈→改物料→重跑） | 跨 N 次 run，每次都是新 DAG instance |

演化层循环**不破坏** DAG 性质——它是 DAG 实例之间的关系，不是 DAG 内部的边。

### 3.3 L3 节点 DAG 示例（doc-maker）

```
                ┌──────────────────────┐
                │   plan (Phase 1)     │
                │   产 plan.yaml       │
                └──────────┬───────────┘
                           │ (fanout)
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ shot_composer│  │ shot_composer│  │ shot_composer│
│   shot_01    │  │   shot_02    │  │   shot_N     │
│ text/tts/    │  │ text/tts/    │  │ text/tts/    │
│ notes        │  │ notes        │  │ notes        │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       ▼                 ▼                 ▼
       (visual 决策当前并入 shot_composer 的 notes 步骤)
       │                 │                 │
       └─────────────────┼─────────────────┘
                         │ (fanin)
                         ▼
                ┌──────────────────────┐
                │ episode_qa (Phase 3) │
                │ 一致性 / 风格 drift   │
                └──────────────────────┘
```

### 3.4 L4 节点内步骤 DAG 示例

**Plan 节点（4 步链）**：

```
Step 1 内容消化 ──→ Step 2 叙事弧 ──→ Step 3 Shot 切分 ──→ Step 4 Eval-Opt
                                                              │
                                              ┌───loop max 3──┘
                                              ▼
                                            done / 入人工
```

**ShotExecutionNode（3 步链）**：

```
Step 1 text 生成 ──┬──→ Step 2 text_tts (依赖 text)
                   └──→ Step 3 notes    (依赖 text + visual_hint)
                            (Step 2 ∥ Step 3 并行)
```

### 3.5 DAG 破坏的早期警报信号

| 信号 | 立刻回 |
|---|---|
| "节点 A 想读节点 B 的输出（不经过 plan）" | ADR-003 / 不变量 #9——这是横向边 |
| "执行流出现循环 / goto" | 不变量 #7——违反 DAG |
| "状态机跨节点共享" | ADR-007 升级触发条件——可能要上 LangGraph，先确认不是误判 |

详见 [`ADRs/024.md`](./ADRs/024.md)。

---

## 4. 技术架构分层（依赖方向）

跟 §3 的"粒度分层 DAG"和 §2 的"跨仓边界"互补——本节是**依赖方向**视角，回答"代码层之间谁依赖谁、哪一层不许动哪一层"。

```
═══════════════════════════════════════════════════════════════════
 技术架构分层图（依赖方向自上而下；不可逆）
═══════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────┐
│ L4 业务节点层    doc-maker/nodes/<name>/                         │
│                                                                  │
│   toy/   plan/   shot_composer/   visual/   episode_qa/         │
│   ─────────────────────────────────────────────────────         │
│   每节点含（ADR-019 就近放）：                                    │
│     node.py (Python class)                                       │
│     prompts/{_model_adapter,_business_rules}/                    │
│     rubrics/  schemas/  style_guides/  exemplars/                │
│     eval/regression/                                             │
│     ui/console.py                                                │
└────────────────────────────┬─────────────────────────────────────┘
                             │ 依赖（仅向下）
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ L3 框架内核层    doc-maker/src/                                  │
│                                                                  │
│   runtime/         Node Protocol / Runner / Eval-Opt 循环 / 重试 │
│   materials/       Registry / train-holdout / 双向 Gate / Budget │
│   eval/            Eval Stack with attribution                  │
│   observability/   Decision Trace + Langfuse 接入                │
│   feedback/        结构化反馈 + 聚类                              │
│   pipeline_io/     跨仓契约：astral-pipeline 读写                 │
└────────────────────────────┬─────────────────────────────────────┘
                             │ 依赖（仅向下）
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ L2 第三方库层（PyPI 包）                                          │
│                                                                  │
│   openai      langfuse     pydantic     tenacity                │
│   typer       rich         streamlit    pyarrow                  │
│   pyyaml      gitpython    anyio                                │
│   pytest      ruff         pre-commit                            │
│                                                                  │
│   (完整清单 + 版本约束见 doc-maker 08-tech-stack.md §1 + §4)    │
└────────────────────────────┬─────────────────────────────────────┘
                             │ 依赖（仅向下）
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ L1 平台与外部 repo 层                                            │
│                                                                  │
│   平台：    Python 3.11+   macOS / Linux   git   uv             │
│                                                                  │
│   外部 repo（不动，跨仓接力）：                                   │
│     astral-pipeline   数据 + 编排（pipeline_io 中介）             │
│     TTS               音频生成（未来接 video-maker）              │
│     Remotion          视频渲染（未来）                             │
│                                                                  │
│   外部服务：                                                      │
│     CLIProxyAPI :8317   →  Anthropic API（Claude Max 订阅）       │
│     ClashX     :7290    →  外网代理（socks5）                     │
│     Langfuse  self-host →  观测                                  │
│     Ollama    :11434    →  本地 LLM（可选，对照实验用）           │
└─────────────────────────────────────────────────────────────────┘
═══════════════════════════════════════════════════════════════════
```

### 4.1 依赖方向铁律

| 铁律 | 违反后果 |
|---|---|
| **L4 → L3 → L2 → L1** 单向依赖，不可逆 | 框架变成业务感知 / 第三方库混进业务节点；架构白拆 |
| **L3 不许依赖 L4**（框架不感知业务节点） | 抽 s2v-core 时拉不出来，drift 永久化 |
| **L4 不许直接 import L2**（节点不直接 `import openai`） | 走 L3 runtime 包装的 LLM call，否则 trace / retry / attribution 都丢 |
| **跨仓调用必须经 L3 的 `pipeline_io`** | 节点 / 测试代码直接读外仓文件 → 跨仓契约失效 / 替换数据仓时撞墙 |
| **L4 节点之间不互相 import** | 横向依赖 = DAG 横向边（违反 ADR-024 / 不变量 #9） |

### 4.2 配套的不变量 / ADR

| 铁律 | 落点 |
|---|---|
| L3 业务无关 | [`ADRs/023.md`](./ADRs/023.md)（命名保持业务无关，方便未来抽 s2v-core） |
| L4 节点不互读 Artifact | 不变量 #9 / ADR-003 |
| L4 走 L3 LLM 包装 | 不变量 #2 #4（所有 LLM call 必经 trace + Decision Trace） |
| L4 跨仓走 pipeline_io | ADR-021 精神延伸（git + CLI + pipeline_io 是 SOT） |

### 4.3 三种视角对照

| 文档 | 视角 | 回答 |
|---|---|---|
| **本节 §4** | **依赖方向**（垂直） | 代码层之间谁依赖谁、哪一层不许动哪一层 |
| **本节 §3** | **粒度分层**（4 层 DAG） | 仓 → 子项目 → 节点 → 步骤 的图论性质 |
| **本节 §2** | **跨仓边界** | 决策仓 / 数据仓 / 音频 / 渲染 的四方分工 |
| **dm 02-architecture §2** | **模块组合** | L3 框架内核内部 6 模块如何协作 |
| **dm 08-tech-stack §1** | **技术选型** | L2 每个第三方库为啥选它、何时换 |

四个视角拼起来 = 完整的项目空间认知。

---

## 6. 演化路径

| 阶段 | 物理变化 | 触发 |
|---|---|---|
| **当前** | `s2v/doc-maker/` 单子项目；docs/ 全在仓根；ADRs/ 全在仓根 | — |
| **第二子项目开工** | 新建 `s2v/<新子项目>/`；同步抽离 `s2v/s2v-core/`（doc-maker 改 import） | ADR-023 触发条件 |
| **docs 拆分** | docs/ 拆"仓根公共" + 各子项目 docs/；ADR 也拆 v1/v2 业务 vs v3 框架 | 第二子项目开工时 |
| **撞 DAG 性质边界** | 跨节点反馈 / 条件路由 / sub-workflow → 立 ADR 说明哪条性质被改变 + 是否升级到 LangGraph | ADR-024 警报信号 + ADR-007 升级条件 |

---

## 7. 与其他文档的关系

| 文档 | 关系 |
|---|---|
| [`../doc-maker/docs/02-architecture.md`](../doc-maker/docs/02-architecture.md) §2 | 6 模块图（L3 框架内核内部协作），跟本文档 §4 的 L3 层对应 |
| [`../doc-maker/docs/02-architecture.md`](../doc-maker/docs/02-architecture.md) §3 | 数据流图——补一个跨仓视角的"pipeline_io 接力" |
| [`../doc-maker/docs/_future/business-design.md`](../doc-maker/docs/_future/business-design.md) §2.1 | doc-maker 内部 workflow 骨架——本文档 §3 的 DAG 形态 |
| [`../doc-maker/docs/08-tech-stack.md`](../doc-maker/docs/08-tech-stack.md) §1 | 技术选型清单——本文档 §4 的 L2 第三方库层详细 |
| dm ADR-019 | 节点级目录就近放——本文档 §1.1 doc-maker/nodes/<name>/ 的依据（见 [`../doc-maker/docs/ADRs/`](../doc-maker/docs/ADRs/)） |
| dm ADR-021 | 无 Web UI 上传（git + CLI 是 SOT）——本文档 §2 pipeline_io 走文件系统的同一精神 |
| 本仓 [`ADRs/023.md`](./ADRs/023.md) | 单仓多子项目 + 抽离时机——本文档 §1 物理结构的决策依据 |
| 本仓 [`ADRs/024.md`](./ADRs/024.md) | 4 层 DAG——本文档 §3 的决策依据 |
