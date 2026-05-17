# doc-maker · Writing Production Prototype

> **这是业务产品原型，不是实施代码**。当前定位：doc-maker 是文本生成生产系统，负责把混乱素材、参考写法和评审偏好转成可批量生成、可评分、可迭代沉淀的规则资产，未来可发布为 Skill Package。
>
> 当前主线见 OpenSpec change：[`add-writing-production-system`](../../openspec/changes/add-writing-production-system/) 与 [`add-writing-job-precheck-flow`](../../openspec/changes/add-writing-job-precheck-flow/)。当前 Writing Rule Scope、Precheck Normalization、Candidate、Feedback Reasoning、Rule Patch Compilation 可接真实 LLM；相似度检测、Skill Package 发布仓库暂不接入。

---

## 跑起来

```bash
cd doc-maker/ui
pnpm install
pnpm dev
# -> http://localhost:3011
```

构建检查：

```bash
pnpm typecheck
pnpm build
```

---

## 路由分层

| # | 路由 | 层 | 当前定位 | 说明 |
|---|---|---|---|---|
| 1 | `/` | L1 Writing Job Workbench | **产品契约** | 输入区、检查区、候选区、Skill Package lifecycle |
| 2 | `/episode/[id]/[artifact]` | L1 Output Profile Viewer | 输出场景 | 讲解文档包查看；作为默认 Output Profile 保留 |
| 3 | `/framework` | L2 Langfuse Lens | **按业务节点诊断** | 用 `runId / nodeRunId / candidateId / round / artifactId` 过滤单节点观测证据 |
| 4 | `/settings/llm` | Runtime Settings | **模型配置** | 配置 mock / Ollama / OpenAI-compatible runtime，加载模型并提供 Test Call |
| 5 | `/hub` | L2 Hub Console | 诊断故事板 | 作者诊断入口 |
| 6 | `/node/*` | L3 Node Console | 诊断故事板 | trace / eval / feedback / rerun 原型 |

---

## 产品抽象

```text
原始输入（标题 / 底稿 / 参考文章 / 外部写作方法包 / 主管偏好）
  -> Start Context（Manual Rule Scope）
  -> Quick Intake（一句话想法）
  -> Reference Paste（可选参考片段）
  -> Writing Rule Scope（用户删减/确认）
  -> Baseline Stack
  -> Job Spec 草稿 + Output Profile
  -> 检查区自动归一
  -> Content Brief + 本轮写法规则草稿 + Eval Profile + 风险检查
  -> 多篇 Candidate Draft
  -> Auto Eval + 选中文本反馈
  -> Feedback Ledger + Rule Patch Drafts（最多 5 条）
  -> Next Generation Run + Rule Snapshot（最多 10 条 active rules）
  -> Finalize Export
```

`structured explanation package` 是默认 Output Profile，继续承载 `plan / scripts / shots / visual_spec / qa_report`。这条线没有被砍掉，只是从产品本质下移到交付形态层。

### Three-zone responsibility

| 区域 | 谁在做 | 职责 |
|---|---|---|
| Start Context | 用户 + LLM | 输入 Quick Intake，可选粘贴参考片段，生成并确认 Writing Rule Scope |
| 输入区 | 用户 | 校正 Job Spec 草稿；补全本轮原始任务、底稿、写法参考和评审偏好 |
| 检查区 | LLM + 用户确认 | LLM 按 baseline schema 自动拆成 Precheck Candidate，用户确认后成为生成契约 |
| Eval Profile | LLM + 用户确认 | LLM 从 Precheck Candidate 派生初始评分契约，候选区按它比较 |

Warning：所有 LLM 自动拆解、规则候选和评分契约都存在黑盒不确定性，必须展示为候选结果，并支持人工确认或修改后再进入生成。

### Type and Skill Package

类型是 `Package Category`，负责归类；Skill Package 是某个类型下经过验证的生产规则包。新建下一主题时，默认流程是：Baseline / No Published Skill Package -> 新建 Job Spec -> Precheck -> Eval Profile -> 候选版本 -> Auto Eval / 选中文本反馈 -> 更新 Rule Patch / Rule Snapshot。只有明确要复用历史写法时，才先选择 Category / Skill Package 版本。

Skill Package 会沉淀整条链路的稳定信号：输入场景、Precheck 拆分规则、Eval Profile 评分规则、有效候选表达策略、反馈和漂移记录。它不是单篇文章的风格 prompt。

Baseline mode 自动带入：Job Spec schema、Precheck schema、Eval Profile seed、Output Profile default、基础 Writing constraints、Governance policy。选择历史 Skill Package 时，再额外带入该 Skill Package 的写法参考和评审偏好。输入区不承担 Skill Package 选择职责，只填写本轮主题材料。

Start Context 下一步收敛为 Manual Rule Scope：用户只填一句话想法，可选粘贴一小段参考片段；系统提炼本轮 Writing Rule Scope，用户删减/确认后再生成 Baseline Stack。当前阶段不做 Source Store、RAG、上传文档库或多文件导入。

### Precheck principle

LLM 不是确定性规则引擎。Precheck 的底层机制是：在 baseline schema 约束下，对输入做语义压缩、模式匹配和结构化生成。schema 约束输出形状，但不能保证理解正确。

Content Brief 由标题、目标、底稿和 Output Profile 派生，负责抽取任务、受众、目的、已知事实、证据缺口和交付约束。风险包括新增事实、遗漏限制、误判受众、把写法参考当事实、把低置信内容写成确定结论。后果是 Draft 跑题、事实漂移、Eval Profile 按错误目标评分，甚至污染 Writing Rules Candidate。

### Score and governance

4 个基础评分来自后台 Auto Eval：基础质量来自 baseline quality rubric，任务匹配来自 Eval Profile + Content Brief，风格偏好来自 Writing Rules Candidate + 评审偏好，风险扣分来自 Risk Check / grounding / similarity。默认人工反馈不是打总分，而是在阅读区选中文本并打轻标签，用于校准下一轮规则。

评分是版本化账本，不是一次性结论。长周期视频反馈、审美变化、低置信 pass 都必须支持 Delayed Feedback 和 Retro Eval。历史评分不覆盖，只追加版本；污染 Skill Package 需要降权、冻结、废弃或回滚。

### Local run runtime

当前已从静态 mock 推进到本地可执行闭环：L1 按钮会调用 `app/api/writing-runs/*`，把 run record 写入 `doc-maker/ui/.writing-runs/*.json`。这不是生产系统；Writing Rule Scope、Precheck Normalization、Candidate、Feedback Reasoning 和 Rule Patch Compilation 可走 `/settings/llm` 配置的真实 LLM，调用失败时回退 deterministic fallback 并写入 trace。Candidate Auto Eval 仍是 deterministic core eval，用来先稳定评分契约和业务/框架解耦边界。

最小链路：

```text
Quick Intake
  -> POST /api/writing-runs
  -> PrecheckRun ready
  -> POST /api/writing-runs/:id/confirm
  -> CandidateRecord[] + EvalRun
  -> POST /api/writing-runs/:id/feedback
  -> HumanFeedbackRecord
  -> POST /api/writing-runs/:id/rule-patches
  -> RulePatch draft（最多 5 条，同类/超额自动合并）
  -> POST /api/writing-runs/:id/generation-batch
  -> RuleSnapshot vNext（最多 10 条 active rules）+ GenerationRun + CandidateRecord[] + EvalRun
```

L1 只展示业务可读结果和评分归因；L2/L3 后续读取同一份 run record 的 trace，不重新定义业务对象。

人工审核默认走最小交互：用户阅读候选稿时选中不满意或喜欢的句子，系统把选中文本、Job Spec、Eval Profile 和候选版本作为输入，生成原因候选；用户点一个反馈标签即写入 Feedback Ledger，并自动生成 Rule Patch。完整评分卡只作为高级能力，不是默认路径。

Candidate Review 和 Finalize Export 分开：评审区只负责反馈、规则草稿和运行下一批；定稿区只负责从候选文本中选择一个 Text Artifact 并导出。

### Job Spec baseline

当前 `/` 只提供 baseline 初始化能力：问题定义、底稿、交付形态、写法参考、评审偏好是内置字段；检查区产物和第一轮评分维度也是内置结构。用户可以编辑本轮内容、写法规则草稿和评分标准，但暂不支持在 UI 新增字段、规则类型或风格类型，新增结构能力需要修改代码。

Quick Intake 是低门槛入口，不改变 Job Spec baseline。它只把一段原始输入映射成 Job Spec 草稿；进入输入区后，用户仍需要确认 5 类字段，检查区才会自动生成 Precheck Candidate。

方法论引用：Creative Brief、Grounding、Structured Outputs、Few-shot / Reference Method、Eval-driven Development。

### Manual Rule Scope runtime

当前已实现一个前置能力，不引入 RAG：

```text
Quick Intake（一句话）
+ Reference Paste（可选）
  -> extract Writing Rule Scope
  -> 用户删减/确认
  -> Baseline Stack
  -> Job Spec / Precheck
```

验收边界：

- [x] 不做 Source Store / RAG / 多文件导入。
- [x] Reference Paste 只是一个可选文本框，不作为独立入口。
- [x] Writing Rule Scope 展示结构、语气、禁忌、检查点、source note 和 confidence。
- [x] Writing Rule Scope 展示本次 provider、model、prompt version、trace id 和 latency。
- [x] Scope / Precheck 真实 LLM 调用期间展示 active node、预计耗时和停止等待；Langfuse Lens 显著标识 failed/fallback trace。
- [x] 用户可删除 scope 项；确认后才影响 Baseline Stack。
- [x] 新增 `Scope extraction eval`，只评估“参考片段 -> 规则范围”的提炼质量。

实现边界：

| 层 | 文件 | 职责 |
|---|---|---|
| LLM Provider | `lib/llm/*` | 支持 mock / Ollama / OpenAI-compatible；Scope / Precheck / Candidate / Feedback / Rule Patch 共用统一 provider |
| Run Store | `lib/run-store.ts` | 本地 JSON `.writing-runs`；未来可替换 DB |
| Workflow Core | `lib/workflow-core/*` | 业务无关的 NodeSpec / ArtifactRef / EvalRun / TraceSink / ScoreSink contract |
| Core Eval | `lib/workflow-core/eval.ts` | 业务无关的 deterministic EvalRun / Attribution runner |
| Framework Contract | `lib/framework-run-types.ts` | 当前 UI 兼容层：`NodeRun / Artifact / EvalRun / LLMCallTraceRecord` |
| TraceSink | `lib/trace-sink.ts` | 统一记录 LLM call trace；有 Langfuse env 时写 Langfuse，否则 local-json fallback |
| ScoreSink | `lib/score-sink.ts` | 将 Core Eval attribution 写入 Langfuse Scores；缺 env 时跳过，不阻塞业务 |
| Framework Trace Builder | `lib/writing-framework-trace.ts` | Writing adapter：把业务事件映射成 NodeRun / LLM call 诊断记录，不承载业务状态 |
| Writing Eval Adapter | `lib/writing-eval-adapter.ts` | 把 Writing Candidate 分数映射到 core eval，再转回 L1 需要的 EvalRun，并写 ScoreSink |
| Business Runtime | `lib/writing-runtime.ts` | Writing Rule Scope、Precheck、Candidate、Feedback、Rule Snapshot 的业务状态流 |
| Client Boundary | `lib/writing-run-client.ts` | 页面调用 API，不直接散落 `fetch` |

当前框架层 eval loop 已有最小 core eval：`candidate_generation` 后通过 `workflow-core/eval.ts` 生成 `CoreEvalRun`，Writing adapter 再转成业务页需要的 score breakdown，并通过 `ScoreSink` 写 Langfuse Scores。每个 LLM-like step 写 `LLMCallTraceRecord`，字段包括 `provider / model / promptVersion / inputRefs / outputArtifact / evalResult / runId / nodeRunId / nodeType`。不做 DAG 调度、RAG 召回评估、真实 judge 或回归测试集。`TraceSink` 是 Langfuse 适配边界，不扩展成观测平台。

Langfuse env：

- `LANGFUSE_HOST` / `LANGFUSE_BASE_URL`：默认 `https://cloud.langfuse.com`；US Cloud 可用 `https://us.cloud.langfuse.com`
- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY`
- `LANGFUSE_ENVIRONMENT`：默认 `development`
- `LANGFUSE_PROJECT_ID`：可选，仅用于 `/framework` 生成 Langfuse trace 深链

没有 Langfuse env 时，业务 run 继续成功，trace 落 local-json；有 env 时，trace / generation / eval score 会进入 Langfuse。

完整接入和验证命令见 [`../docs/reference/langfuse.md`](../docs/reference/langfuse.md)。

### LLM runtime settings

`/settings/llm` 是当前唯一模型配置入口：

- `mock`：默认 runtime，不访问外部模型。
- `ollama`：本机 Ollama，例如 `http://localhost:11434`。
- `openai-compatible`：OpenAI-compatible `/chat/completions` endpoint。
- API Key 不在页面输入，也不写入本地 JSON；只读取 `DOC_MAKER_LLM_API_KEY` 或 `OPENAI_API_KEY`。
- 模型列表可从 Ollama `/api/tags` 或 OpenAI-compatible `/models` 加载；仍保留手填模型名以兼容本地 CPA/代理别名。
- Test Call 成功或失败都会生成 `LLMCallTraceRecord`，用于验证 TraceSink 失败路径。

当前真实 LLM 已接入 `Writing Rule Scope`、`Precheck Normalization`、`Candidate Generation`、`Feedback Reasoning`、`Rule Patch Compilation`。`Candidate Auto Eval` 仍是 deterministic core eval，因为它承担的是可解释评分契约和 Langfuse Scores 写入，不是文本生成。

### Baseline registry

每个 baseline 检查项必须说明：来源字段、方法论依据、派生结果、后续影响、可迭代位置。检查区不展示无法追溯到输入字段的 mock 结论。

检查区与输入区是一对多派生关系：问题定义、底稿、Output Profile、写法参考、评审偏好分别影响 Content Brief、写法规则、Eval Profile 和风险检查。`来源：底稿` 表示事实/证据边界；`来源：Output Profile` 表示交付结构和验收格式。

### L1（`/`）验收清单

- [x] Start Context 默认使用 Baseline / No Published Skill Package；历史 Category / Skill Package 只作为可选模板，并展示自动填充的 baseline stack。
- [x] 读取最近 run 后可一键新建 Job 草稿；该操作只重置当前页面，不删除历史 run record。
- [x] Start Context 支持 Quick Intake 单入口：一段原始输入生成可编辑 Job Spec 草稿。
- [x] Job Spec 创建区支持问题定义、底稿、交付形态、写法参考、评审偏好五类 baseline 输入，且本轮内容可编辑。
- [x] Job Spec 创建区说明 baseline 设计理念、方法论引用和当前不可自定义的边界。
- [x] Output Profile 明确保留结构化讲解文档包作为默认交付形态。
- [x] 编辑任一 Job Spec 字段后，候选区失效，检查区自动基于当前输入重新加载。
- [x] 输入区和检查区在同一工作台左右分栏展示，检查区可对照输入区确认。
- [x] 宽屏使用输入区 / 检查区 / Eval Profile 三分栏，保证评分契约在第一屏可见。
- [x] 检查区默认自动加载；进入候选区的动作放在检查区底部。
- [x] 候选区在检查结果确认前不展示，确认后才展示多篇候选。
- [x] 检查区固定展示 Content Brief、写法规则来源、Eval Profile、风险检查。
- [x] 左侧输入字段 hover/focus 时，右侧关联检查项高亮。
- [x] 检查区解释来源字段、方法论依据、后续影响和未来可迭代位置。
- [x] 检查区头部以状态 badge 表示自动加载，主体不展示说明卡。
- [x] Eval Profile 第一轮非空，并可展开查看基础质量、任务匹配、风格偏好、风险扣分。
- [x] 多篇候选版本展示为 Version 1/2/3，明确它们是同一生成契约下的不同表达策略。
- [x] 候选区区分 Auto Eval 与人工轻反馈，4 个基础评分标注为后台 Auto Eval。
- [x] 多篇候选 Draft 展示标题、摘要、正文片段、自动评分和 score breakdown。
- [x] 人工反馈写入 Feedback Ledger，只进入 Rule Patch / 下一轮，不直接覆盖旧候选或 Published Skill Package。
- [x] 候选文本支持选中文本反馈：LLM 自动生成原因候选，点击标签即写入 feedback ledger，标签可撤回。
- [x] 反馈、规则更新、重跑生成解耦：反馈先进入 RulePatch，点击“运行下一批”才生成新的 GenerationRun。
- [x] Rule Patch 草稿池最多 5 条，Active Rule Snapshot 最多 10 条规则；同类或超额反馈自动合并。
- [x] Finalize Export 独立于 Candidate Review，负责最终选择和导出。
- [x] 本地 JSON run store 支持 Job / PrecheckRun / Candidate / EvalRun / Feedback / RulePatch / RuleSnapshot / GenerationRun / RulesCandidate。
- [x] Skill Package Lifecycle 说明 Drift Review、Retro Eval、Delayed Feedback 和规则栈清理。
- [x] 相似表达和事实漂移风险可见，避免把仿写误解为复制句子。
- [x] Skill Package 展示 candidate / ready-to-publish / published / blocked 生命周期。
- [x] Codex/Claude `SKILL.md` 技术导出作为高级动作，不进入普通流程。

---

## UI 纪律

- 这是生产控制台，不是 landing page，也不是富文本编辑器。
- 用户看到写作资产和生产任务，不看到 prompt、agent、内部 schema。
- 默认选择 neutral 工作台风格；风险用少量 amber/red 标识。
- 卡片只承载独立信息块，不做卡套卡。
- L2/L3 仍然是诊断层；L1 跑通时不需要理解节点。

---

## 项目结构

```text
ui/
├── app/
│   ├── page.tsx                # / L1 Writing Job Workbench
│   ├── framework/page.tsx      # /framework L2 real run trace viewer
│   ├── settings/llm/page.tsx   # /settings/llm model runtime settings
│   ├── api/writing-runs        # local behavior mock runtime API
│   ├── api/settings/llm        # LLM runtime settings + model discovery + test call
│   ├── episode/[id]/[artifact] # legacy output viewer
│   ├── hub/page.tsx            # /hub L2
│   └── node/*                  # L3 diagnostic storyboards
├── components/
│   ├── ui/                     # shadcn primitives
│   ├── l1/                     # legacy episode components
│   ├── l2/
│   └── l3/
└── lib/
    ├── framework-run-types.ts  # generic NodeRun / Artifact / EvalRun contract
    ├── llm/                    # mock / Ollama / OpenAI-compatible provider boundary
    ├── mock.ts                 # legacy + diagnostic mock data
    ├── run-store.ts            # local JSON RunStore abstraction
    ├── trace-sink.ts           # local JSON TraceSink, future Langfuse sink boundary
    ├── workflow-core/eval.ts   # generic deterministic eval runner
    ├── writing-eval-adapter.ts # maps Writing candidates to core eval
    ├── writing-framework-trace.ts # maps business events to framework diagnostic records
    ├── types.ts
    ├── writing-run-client.ts   # client API boundary
    ├── writing-run-types.ts    # local run record contracts
    └── writing-runtime.ts      # deterministic writing pipeline runner
```

---

## 不实现的

- 除 Writing Rule Scope / Precheck Normalization 以外的真 LLM 生成、真实 eval judge、真实相似度算法。
- 持久化数据库、多人协作、权限系统。
- 直接编辑技术 `SKILL.md`。
- 把旧 Episode 文档包页面删除；它们先作为历史/诊断场景保留。
