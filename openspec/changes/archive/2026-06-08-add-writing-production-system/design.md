## Context

当前 UI 已证明“文档包生成工作台”不是最高层产品本质。它仍然成立，但应作为 `Output Profile` 挂在文本生产系统之下。真实业务问题是：用户有混乱素材、外部写作方法包、参考文章/转录稿、主管不稳定偏好，但需要稳定地产出可比较、可评分、可迭代的文本。

产品应被设计为文本生产系统：

```text
Raw Input
  → Start Context（Manual Rule Scope）
  → Quick Intake + optional Reference Paste
  → Writing Rule Scope
  → Baseline Stack
  → Job Spec + Output Contract
  → Precheck
  → Content Brief + Writing Rules Candidate + Eval Profile
  → Candidate Run
  → Auto Eval + Human Selection Feedback
  → Feedback Ledger + Rule Patch Drafts
  → Next Generation Run + Rule Snapshot
  → Finalize Export
```

核心约束：
- 用户不应直接面对复杂 schema。
- 输入可以混乱，但进入生成前必须被标准化。
- 输出形态可以不同，但必须通过 Output Profile 表达；结构化讲解文档包是首个 Output Profile。
- Eval Profile 第一轮不能为空，必须由系统默认规则 + Job Spec 派生规则 + 参考/偏好派生规则组成。
- Writing Rules Candidate 是本轮规则候选，不是 prompt，也不是标准 Skill。Skill Package 才是可发布、可安装、可测试的能力包。
- 初始化层先采用 Manual Rule Scope，不接 Source Store / RAG，避免引入检索质量和额外 eval 面。

## Goals / Non-Goals

**Goals:**
- 将产品主入口改为创建 Writing Job。
- 保留结构化讲解文档包，将其定义为默认 Output Profile，而不是删除旧路径。
- 将 Precheck 设计为第一层产品契约，产出固定结构。
- 明确 Content Brief 与 Writing Rules Candidate 的边界：前者本期使用，后者可复用候选。
- 建立自动 eval + 选中文本轻反馈 + 规则草稿的第一轮闭环。
- 为后续 UI mock 提供清晰页面结构。

**Non-Goals:**
- 不在本 change 里实现真实 Candidate 生成、真实相似度检测或真实 Skill Package 发布仓库。
- 不承诺自动从任意参考内容生成完美写作方法包。
- 不实现 Source Store、RAG、上传文档库或多文件导入。
- 不把产品做成富文本编辑器。
- 不让用户直接维护 Codex/Claude 格式的 `SKILL.md`。

## Decisions

### 决策 1：统一输入为 Job Spec

用户可输入标题、底稿、参考文章、外部写作方法包、主管要求等，但 UI 和系统内部统一归一到 `Job Spec`。

最小结构：
- `goal`：写什么、发布在哪里、目标受众。
- `source`：事实、观点、底稿、链接、转录稿。
- `writing_inputs`：参考文章、写作方法包、账号风格。
- `constraints`：字数、禁忌、必须覆盖点。
- `review_preferences`：主管要求、评分重点、历史偏好。

理由：动态输入会导致复杂性爆炸。统一 Job Spec 让复杂输入先被收束，再进入固定流程。

### 决策 2：Precheck 产出三件套

Precheck 不只是清洗素材，而是产出：
- `Content Brief`：本期写什么，事实/观点/约束/风险。
- `Writing Rules Candidate`：本期抽取出的写法、结构、节奏、风格、禁忌。
- `Eval Profile`：本轮临时评分标准。

理由：如果 Precheck 只产出 brief，写作方法仍然会留在隐性 prompt 里，无法 eval、复用、发布。

### 决策 3：Eval Profile 自动生成但可编辑

用户创建 Job Spec 后，Precheck 页面必须提示“已自动生成本轮评分标准”。默认折叠，用户可展开修改权重、删除规则、加入主管禁忌。

第一轮 Eval Profile 由三层组成：
- 基础质量：通顺、完整、无明显废话。
- 任务匹配：标题、渠道、字数、受众、素材覆盖。
- 风格/偏好：参考写法、外部写作方法包、主管偏好。

理由：第一轮 eval 不能为空；但如果强迫用户先写评分规则，会降低创建 Job 的效率。

### 决策 4：Rules Candidate 先迭代，稳定后才发布 Skill Package

外部写作方法包、参考文章和主管反馈先被编译为 `Writing Rules Candidate`。Candidate 只绑定当前 Job/轮次；经过多轮生成、自动 eval、人工反馈和风险复核后，才可进入发布设计。当前 baseline 原型不支持 UI 发布。

未来发布条件至少包括：
- 多轮表现稳定。
- 人工反馈收敛。
- 没有高风险相似表达。
- 有版本说明和适用范围。

理由：把一次参考内容直接发布为 Skill Package 会污染资产库。

### 决策 5：UI 是生产控制台，不是编辑器

首页优先展示 Jobs、Precheck 状态、候选文本评分和 Skill Package 资产状态。编辑文本是局部动作，不是产品核心页面模型。

理由：产品核心价值是生产、评分、筛选、沉淀，而不是替代 Notion/Docs。

### 决策 6：讲解文档包是 Output Profile

`plan / scripts / shots / visual_spec / qa_report` 不再定义产品顶层入口，而是作为 Writing Job 的默认 `Output Profile`。Job Spec 仍描述“写什么、给谁看、如何评审”；Output Profile 描述“最终如何包装和交付”。

理由：这样保留原业务设计，同时避免产品被单一产物类型锁死。未来可以增加普通长文、决策复盘、公众号稿、视频脚本文案等 Output Profile。

### 决策 7：初始化层先做 Manual Rule Scope

Start Context 不再继续扩展为完整知识库入口。下一步只支持：

- `Quick Intake`：一句话想法或一小段本轮说明。
- `Reference Paste`：可选参考片段，来自文章、转录稿或历史写作规则。
- `Writing Rule Scope`：LLM 从参考片段提炼出的结构、语气、禁忌、检查点和 source note。
- `Baseline Stack`：由系统 baseline + confirmed scope 共同初始化 Job Spec、Output Contract、Eval Profile seed 和 Precheck rules。

理由：Source Store / RAG 会新增检索、分块、召回、权限、provenance 和检索 eval。当前阶段先验证“手动提供参考片段 -> 提炼规则范围 -> 进入生成闭环”，避免把输入层做重。

当前只新增 `Scope extraction eval`：检查 Writing Rule Scope 是否准确、是否过度仿写、是否遗漏禁忌。Job Eval 继续沿用现有候选评审闭环。

### 决策 8：先固定 TraceSink contract，再接 Langfuse

前置 LLM-like step 必须统一进入 `TraceSink`，而不是在业务代码里直接散落 Langfuse 调用。

当前 trace contract：
- `provider`
- `model`
- `promptVersion`
- `inputRefs`
- `outputArtifact`
- `evalResult`
- `runId`
- `nodeType`

当前 sink 是本地 JSON run record；后续增加 `LangfuseTraceSink` 时，只替换 sink，不改变 Writing Runtime 的业务对象。

理由：Langfuse 是 trace sink，不是业务流程编排器。先固定 contract，才能保证 scope extraction、precheck normalization、candidate generation、feedback reasoning、rule patch compilation 这些前置 LLM 调用都能被同一种方式观察。

### 决策 9：先做 LLM Runtime Settings，只把真实 LLM 接入 Scope 和 Precheck

新增 `/settings/llm` 作为独立 runtime 配置页，支持 `mock / ollama / openai-compatible`。配置只保存 provider、base URL 和 model；API Key 只从 env 读取，不在页面输入，也不写入本地 JSON。

设置页支持从当前 runtime 加载模型列表：Ollama 读取 `/api/tags`，OpenAI-compatible 读取 `/models`。模型仍允许手填，因为本地 CPA 或代理网关可能暴露别名模型、转发模型或临时模型名。

当前真实 LLM 先接入两个前置节点：

`Writing Rule Scope`：
- 输入：Quick Intake + Reference Paste。
- 输出：结构、语气、禁忌、检查点、source note、confidence、scope extraction eval。
- 失败：返回显式 fallback warning，并通过 Test Call 记录 failed trace。

`Precheck Normalization`：
- 输入：Job Spec + Output Contract + confirmed Writing Rule Scope。
- 输出：Content Brief、Grounding Brief、Writing Rules Candidate、Risk List。
- 失败：返回显式 fallback warning，并回退 deterministic Precheck。

Candidate 和 Eval 暂保留 deterministic runtime。

理由：如果同时把 Scope、Precheck、Candidate、Eval 全部切到真实 LLM，会一次性引入多处不可控变量。先让输入前置层和生成契约真实化，可以验证 provider 配置、JSON schema、失败 trace 和人工确认路径。

### 决策 10：先收口边界，不继续加 Candidate Guard

在 Scope / Precheck 接入真实 LLM 后，暂停新增 Candidate schema guard、regression fixtures、Source Store / RAG 等能力。当前下一步只做架构边界收口：

- `writing-runtime.ts` 只负责业务状态流。
- `writing-framework-trace.ts` 只负责把业务事件映射为 NodeRun / LLM call 诊断记录。
- `TraceSink` 是 Langfuse 接入前的适配边界，不自研观测平台。
- `/framework` 是 L2 诊断入口，不成为新的业务工作台。

理由：继续扩展候选生成保护层会提前把系统推向自研 eval/observability 平台。当前更重要的是保持 L1 业务路径可理解，并让 L2 诊断能力有清晰替换边界。

### 决策 11：实现最小 Core Eval，而不是评测平台

新增 `workflow-core/eval.ts`，只定义业务无关的 deterministic Eval runner：

- 输入：eval dimensions、candidate scores、evidence。
- 输出：`CoreEvalRun`、candidate result、attribution、pass/warning/blocked 状态。
- Writing 侧通过 `writing-eval-adapter.ts` 把 Candidate breakdown 映射进 Core Eval，再转回 L1 当前展示结构。

当前不接真实 LLM judge、不做大规模 regression、不接 Langfuse sink。理由：先验证 `EvalRunner -> EvalResult -> TraceSink/FrameworkNodeRun` 是否能服务现有业务闭环，再决定是否升级 judge 或观测平台。

## Risks / Trade-offs

- **Precheck 过重导致首次使用慢** → 用默认 Job Spec 和自动 Eval Profile；用户只确认，不必填 schema。
- **Writing Rules Candidate 看起来像 prompt** → UI 用“写法资产”语言展示结构、节奏、禁忌、检查表，不展示内部 prompt。
- **参考内容带来版权/过度仿写风险** → Precheck 和 Eval 必须显示相似表达风险，并明确“仿结构，不仿句子”。
- **主管偏好不稳定导致 规则震荡** → Review Memory 记录偏好版本和冲突，不直接覆盖已发布 Skill Package。
- **Eval Profile 误导用户以为是长期规则** → UI 明确标注“本轮临时评分标准”，稳定后才可沉淀。

## Migration Plan

1. 新增 OpenSpec spec，定义 Writing Job、Precheck、生成/eval 闭环、Rule-to-Skill Package 生命周期。
2. 更新 `doc-maker/ui` mock：L1 从 Episode 列表改为 Writing Job 工作台。
3. 新增 Precheck preview 区：展示 Content Brief、Writing Rules Candidate、Eval Profile、风险。
4. 新增生成结果区：多篇候选文本、自动评分、选中文本反馈、反馈账本和规则草稿。
5. 新增定稿导出区：从候选文本中选择一个 Text Artifact 导出。
6. 新增 Skill Package 资产区：Candidate、Published、Deprecated 状态说明；当前 baseline 不发布。
6. 保留旧 Episode/diagnostic 页面，并把结构化讲解文档包解释为默认 Output Profile。

回滚策略：保留当前 `promote-business-prototype` change 的文档和 mock diff，不归档旧文档前可恢复为文档包工作台。

## Open Questions

- Published Skill Package 最终是否要兼容 Codex/Claude `SKILL.md` 格式，还是只导出内部 JSON/YAML？
- 主管反馈是按人建 profile，还是按账号/项目建 profile？
- 相似表达风险第一版用规则/LLM judge mock，还是接真实文本相似度算法？
