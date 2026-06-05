# Framework Core · 可迁移框架层实现设计

> 本文定义框架层实现边界。L1 Writing Job 是业务产品层；Framework Core 是业务无关内核；Langfuse 是观测系统。`/framework` 只能作为诊断 Lens，不能成为自研日志中台或新的业务工作台。

## 1. 定位

Framework Core 解决的问题：

> 让任意业务节点都能用同一套运行、追踪、评分、反馈和诊断协议接入，而不把业务概念写进框架内核。

框架层必须满足：

| 要求 | 含义 |
|---|---|
| 业务无关 | Core 不 import `writing-*`，不认识 Job、Candidate、RulePatch |
| 可复用 | 新业务节点只定义 input/output/eval/adapter，就能接入运行与观测 |
| 可迁移 | 后续可抽成 `workflow-core` 包，被 `doc-maker / tts-maker / video-maker` 复用 |
| 可观测 | 所有 LLM call 进入 Langfuse trace；所有 eval 进入 Langfuse scores |
| 可排查 | L3 Per-Node Console 只看单节点，不做跨节点聚合中台 |

## 2. 分层

```text
L1 Business Console
  owns: Writing Job / Candidate / Feedback / Finalize
  depends on: writing-adapter

Business Adapter
  owns: Writing object -> Core object mapping
  depends on: workflow-core

Workflow Core
  owns: WorkflowRun / NodeSpec / NodeRun / ArtifactRef / EvalRun / FeedbackSignal / SnapshotRef
  depends on: observability interface

Observability
  owns: TraceSink / ScoreSink / DecisionTraceSink
  implementations: LangfuseSink + local-json fallback

Langfuse
  owns: trace / observation / score / token / latency / error
```

依赖方向只允许向下：

```text
writing-domain -> workflow-core
writing-domain -> observability
observability -> workflow-core
observability -> langfuse
ui -> writing-domain / observability
```

禁止：

```text
workflow-core -> writing-*
observability -> writing-*
L1 UI -> raw Langfuse query assembly
```

## 3. 核心契约

### 3.0 当前实现状态

截至 2026-05-21，框架层已从 `ui/lib` 迁出，形成三个显式包目录：

| 包 | 路径 | 职责 |
|---|---|---|
| `workflow-core` | `doc-maker/packages/workflow-core/src/` | 业务无关协议：Artifact / NodeRun / Eval / Trace / Feedback / Snapshot / WorkflowRun |
| `observability` | `doc-maker/packages/observability/src/` | TraceSink / ScoreSink / Langfuse 映射 / local-json fallback |
| `writing-domain` | `doc-maker/packages/writing-domain/src/` | Writing 业务域 runtime、LLM provider、store、eval adapter、workflow adapter |

第一层核心协议状态：

| 文件 | 状态 | 说明 |
|---|---|---|
| `artifact.ts` | 已有 | `ArtifactRef`，跨业务边界引用输入/输出产物 |
| `node.ts` | 已有 | `NodeSpec`、`NodeRunRecord` |
| `eval.ts` | 已有 | `CoreEvalRun`、deterministic eval attribution |
| `trace.ts` | 已有 | `LLMCallTraceRecord`、TraceSink contract |
| `score.ts` | 已有 | ScoreSink contract |
| `feedback.ts` | 已有 | `WorkflowFeedbackSignal` |
| `snapshot.ts` | 已有 | `WorkflowSnapshotRef` |
| `run.ts` | 已有 | `WorkflowRunRecord` 聚合协议 |

当前还不是独立 npm workspace package，而是源码包目录 + TypeScript path alias。这样可以先拿到清晰边界，又避免引入 monorepo 发布/版本管理负担。判断是否继续升为 workspace package 的标准是：新增第二个业务域时，能否只新增 domain adapter，而不是复制 `runtime.ts`。

### 3.0.1 WorkflowRunRecord

`WorkflowRunRecord` 是跨业务的投影视图，不替代业务 store。

```ts
type WorkflowRunRecord = {
  id: string;
  domain: string;
  status: "draft" | "running" | "ready" | "feedback" | "finalized" | "failed";
  inputArtifacts: ArtifactRef[];
  outputArtifacts: ArtifactRef[];
  nodeRuns: NodeRunRecord[];
  evalRuns: CoreEvalRun[];
  feedbackSignals: WorkflowFeedbackSignal[];
  snapshots: WorkflowSnapshotRef[];
  metadata: Record<string, string | number | boolean | null>;
};
```

设计含义：

- 业务对象仍由业务 store 管理。
- Core 只读取 ArtifactRef / NodeRun / Eval / Feedback / Snapshot 这些可复用协议。
- L2/L3 可以基于 `WorkflowRunRecord` 做通用观测，不理解 Writing / Candidate / Topic。

### 3.1 NodeSpec

业务新增节点时只注册节点能力，不改框架内核。

```ts
type NodeSpec<TInput, TOutput> = {
  id: string;
  version: string;
  inputSchema: SchemaRef;
  outputSchema: SchemaRef;
  run(input: TInput, ctx: NodeRunContext): Promise<TOutput>;
  eval?: (output: TOutput, ctx: NodeRunContext) => Promise<EvalRun>;
};
```

### 3.2 NodeRunRecord

框架层只记录节点运行事实。

```ts
type NodeRunRecord = {
  id: string;
  nodeId: string;
  nodeVersion: string;
  runId: string;
  status: "complete" | "failed" | "skipped";
  inputRefs: ArtifactRef[];
  outputRefs: ArtifactRef[];
  evalRunRefs: string[];
  traceRefs: TraceRef[];
  startedAt: string;
  completedAt?: string;
  metadata: Record<string, string | number | boolean | null>;
};
```

### 3.3 ArtifactRef

Artifact 是跨层边界，不直接传业务对象。

```ts
type ArtifactRef = {
  id: string;
  kind: string;
  version: string;
  uri?: string;
  summary: string;
  materialRefs: string[];
  metadata: Record<string, string | number | boolean | null>;
};
```

### 3.4 EvalRun

Eval 必须有 attribution。没有 attribution 的评分只能标记为 `skipped` 或 `invalid`。

```ts
type EvalRun = {
  id: string;
  nodeRunId: string;
  profileVersion: string;
  status: "complete" | "skipped" | "invalid";
  targetArtifactRef: string;
  dimensions: EvalDimensionResult[];
  total?: number;
};
```

### 3.5 FeedbackSignal / SnapshotRef

Feedback 和 Snapshot 是支持多轮迭代的核心对象。

```ts
type WorkflowFeedbackSignal = {
  id: string;
  targetArtifactRef: ArtifactRef;
  status: "unprocessed" | "compiled" | "dismissed";
  verdict?: string;
  issue?: string;
  expected?: string;
};

type WorkflowSnapshotRef = {
  id: string;
  kind: string;
  version: string;
  status: "active" | "archived";
  sourceRefs: string[];
  summary: string;
};
```

这两个对象不能写死为 RulePatch / RuleSnapshot。Writing 里它们表现为规则补丁和规则快照；未来口播、TTS、分镜节点可以表现为不同的风格约束、格式约束或下游工具约束。

## 4. Langfuse 映射

Framework Core 不重做 Langfuse，只做映射。

| Core 对象 | Langfuse 对象 | 说明 |
|---|---|---|
| `Run` | Trace | 一次业务 run 或节点 run 的顶层 trace |
| `NodeRun` | Span | 节点执行边界 |
| `LLMCall` | Generation / Observation | 模型调用、prompt version、input/output、token、latency |
| `EvalRun` | Scores | 独立 eval 分数、人工评分、LLM judge 分数 |
| `FeedbackEvent` | Score + metadata | 选中文本反馈、延迟反馈、复评 |
| `ArtifactRef` | metadata | 只存 ref 和摘要，artifact 内容仍由业务 store/git 管 |

Langfuse metadata 必须带查询键：

```ts
{
  project: "doc-maker",
  runId,
  nodeRunId,
  nodeId,
  nodeVersion,
  round,
  artifactId,
  candidateId,
  evalRunId
}
```

## 5. Eval 节点推进方式

当前不引入大规模评测平台，先把现有 deterministic eval 接入框架契约。

```text
Candidate generation
  -> Candidate ArtifactRef[]
  -> Core EvalRunner
  -> EvalRun with attribution
  -> ScoreSink.writeScores()
  -> Langfuse Scores
  -> L1 读取业务 view model
```

实施纪律：

| 阶段 | 做什么 | 不做什么 |
|---|---|---|
| Phase 1 | deterministic eval 写 Core EvalRun + Langfuse Scores | 不接 LLM judge |
| Phase 2 | 人工轻反馈写 Score + FeedbackEvent | 不做多评审治理 |
| Phase 3 | LLM-as-judge 作为 evaluator 节点 | 不替换人工判断 |
| Phase 4 | regression / dataset / experiment | 不塞进 L1 默认流程 |

## 6. UI 边界

### L1

L1 只显示业务可读信息：

- 当前生成状态
- 候选文本
- Auto Eval 摘要
- 人工轻反馈
- 定稿导出
- 出问题时的“查看该节点执行详情”

L1 不展示：

- Langfuse 原始 trace 列表
- prompt diff
- token/cost 明细
- 跨节点聚合表

业务侧 LLM 轻处理节点使用同一套监控摘要：

| 字段 | 用途 |
|---|---|
| `status` | complete / failed / fallback / missing |
| `provider / model` | 确认调用来源 |
| `latencyMs` | 发现慢节点 |
| `outputArtifact.summary` | 看处理结果是否可信 |
| `evalResult` | 看自动检查是否通过 |

典型轻处理节点包括 `Writing Rule Scope`、`Precheck Normalization`、`Feedback Reasoning`。L1 只显示这些摘要和“执行详情”入口；prompt、token、cost、error detail 交给 Langfuse Lens。

### L3 / Langfuse Lens

L3 只看一个节点。入口必须带条件：

```text
/framework?runId=...&nodeRunId=...&artifactId=...&round=...&candidateId=...&traceId=...&returnTo=...
```

直接进入 `/framework` 时，只能默认选择最近 run 的第一个节点作为诊断入口，不能平铺所有 raw log。没有 run 时显示空态和配置指引。

Langfuse Lens 的职责：

| 场景 | Lens 做什么 | 不做什么 |
|---|---|---|
| 从 L1 节点进入 | 带入 `runId + nodeRunId`，展示该节点输入、输出、eval、trace 深链 | 不展示整轮 raw log |
| 直接进入 | 默认展示最近 run 的节点目录，并选中第一个节点 | 不自动展开全局日志 |
| 排错 | 显示 fallback / failed / score sink 状态 | 不替代 Langfuse 的 trace 查询 |
| 深链 | 配置 `LANGFUSE_PROJECT_ID` 后生成 trace 链接 | 不把 public key 当 project id |

Langfuse 具体接入见 [reference/langfuse.md](./reference/langfuse.md)。

#### 当前 Lens UI 约束

Framework Lens 采用和 L1 一致的工作台骨架，但信息层级不同：

| 区域 | 宽屏职责 | 窄屏职责 |
|---|---|---|
| 左侧 Run Picker | 选择 run，只显示 run 摘要 | 折叠隐藏，不挤占诊断主线 |
| 中央 Node Lens | 节点目录、节点输入输出、eval 摘要、候选关联 | 保持主阅读区，不因侧栏缺失跳动 |
| 右侧 Trace Inspector | 当前节点的模型调用时间线、输入内容、输出内容、Langfuse 链接 | 下移到中央下方 |

深链规则：

| 参数 | 优先级 | 行为 |
|---|---:|---|
| `traceId` | 1 | 优先选中匹配的 LLM call，并反推对应 `nodeRunId` |
| `nodeRunId` | 2 | 选中指定流程节点 |
| `candidateId` | 3 | 在候选列表中置顶并标记“当前候选” |
| `returnTo` | 4 | 返回 L1 时保留 `runId / stage / candidateId` |

设计底线：

- L1 入口必须是“观测 / 执行详情”，不能藏在候选卡片二级操作里。
- Framework Lens 可以显示本地 JSON trace，但必须标注 local fallback，不能伪装成 Langfuse。
- Run 和 Node 是父子关系：Run 负责选择一次业务执行，Node 负责查看一次流程节点。两者不能并排成同级导航。
- 候选深链用于排查“这个候选是怎么生成和评分的”，不是让用户在 Lens 中继续编辑业务数据。

## 7. 与当前 writing 业务实现解耦

当前实现里的业务耦合点：

| 耦合点 | 问题 | 处理 |
|---|---|---|
| `FrameworkNodeType` 枚举写死 writing 节点 | core 认识业务 | 改为 `nodeId: string` |
| `.writing-runs` 同时存业务状态和诊断记录 | store 边界混合 | 保留业务 store，新增 core refs |
| `/framework` 平铺 run 记录 | 像日志中台 | 改为条件化 Lens |
| `CoreEvalRun` 未写 Langfuse Scores | eval 不可观测 | 增加 `ScoreSink` |
| trace 只 local-json | 违反早接 Langfuse 方向 | 增加 `LangfuseTraceSink` |
| Human Feedback 只在业务账本 | 人工信号不可观测 | 写入 Langfuse Score + metadata |

解耦后的 writing 只保留 adapter：

```text
WritingRunRecord
  -> writing-workflow-adapter.toWorkflowRun()
  -> WorkflowRunRecord
  -> L2/L3 generic lens / regression tests
```

当前已新增 `lib/writing-workflow-adapter.ts`，负责：

| Writing 对象 | Core 投影 |
|---|---|
| `quickIntake / jobSpec` | `inputArtifacts[]` |
| `CandidateRecord` | `outputArtifacts[]` |
| `frameworkRuns` | `nodeRuns[]` |
| `evalRun.coreEval` | `evalRuns[]` |
| `HumanFeedbackRecord` | `feedbackSignals[]` |
| `RuleSnapshotRecord` | `snapshots[]` |

下一步才考虑把 runtime 执行本身迁到 core runner。当前先保证“业务记录能投影为框架协议”，这是最低风险的解耦切口。

## 8. 当前难点

1. **历史 mock 数据混杂**
   `.writing-runs` 已经存了业务状态、frameworkRuns、llmTraces。短期保留兼容，新增 run 按新 contract 写。

2. **Langfuse 与 local-json 双写策略**
   Langfuse 失败不能阻塞业务 run；local-json fallback 必须保留，trace 里记录 `sinkStatus`。

3. **Eval attribution 粒度**
   当前 deterministic eval 有 attribution，但还没有标准 `violated_rule_ref / anchor / citation / thinking`。先保留现有 evidence，下一步补齐字段。

4. **UI 入口粒度**
   业务节点必须带查询条件跳入 Lens，否则又会退化成日志中台。

## 9. 实施切分

### Step 1：文档与命名收口

- `/framework` 语义改为 Langfuse Lens，不再叫业务工作台。
- ADR 锁定：Framework Core 是可迁移内核，Langfuse 是观测 SOT。

### Step 2：Core contract 重构

- 已迁移到 `doc-maker/packages/workflow-core/src/node.ts`
- 已迁移到 `doc-maker/packages/workflow-core/src/artifact.ts`
- 已迁移到 `doc-maker/packages/workflow-core/src/trace.ts`
- 已迁移到 `doc-maker/packages/workflow-core/src/run.ts`
- 已迁移到 `doc-maker/packages/workflow-core/src/feedback.ts`
- 已迁移到 `doc-maker/packages/workflow-core/src/snapshot.ts`
- 已将 `FrameworkNodeType` 改为 `string`

### Step 3：Observability sink

- 已迁移到 `doc-maker/packages/observability/src/trace-sink.ts`
- 已迁移到 `doc-maker/packages/observability/src/score-sink.ts`
- local-json 作为 fallback
- settings 支持 `LANGFUSE_HOST` / `LANGFUSE_BASE_URL`、`LANGFUSE_PUBLIC_KEY`、`LANGFUSE_SECRET_KEY` 从 env 读取

### Step 4：Writing adapter 接入

- 已迁移到 `doc-maker/packages/writing-domain/src/workflow-adapter.ts`，可把 `WritingRunRecord` 投影为 `WorkflowRunRecord`。
- Candidate eval 已写 `CoreEvalRun`，并通过 ScoreSink 写入 Langfuse/local fallback。
- 后续再把 Scope / Precheck / Candidate / Feedback / RulePatch 的执行入口逐步迁入 core runner。

### Step 5：L1 节点级入口

- 只在相关业务节点显示“执行详情”。
- 链接带 `runId/nodeRunId/round/candidateId`。

### Step 6：Lens UI 收敛

- 默认选中最近 run 的第一个节点，避免空白页。
- 有条件时只显示相关 run / node / candidate / trace。
- 提供 Langfuse 深链，不复制 Langfuse 全功能。

## 10. 外部依据

- Langfuse data model: <https://langfuse.com/docs/observability/data-model>
- Langfuse observation types: <https://langfuse.com/docs/observability/features/observation-types>
- Langfuse scores: <https://langfuse.com/docs/evaluation/scores/overview>
- Langfuse TypeScript SDK: <https://langfuse.com/docs/sdk/typescript/guide>
