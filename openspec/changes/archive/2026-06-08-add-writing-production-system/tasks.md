## 1. 产品文档重定位

- [x] 1.1 更新 `doc-maker/docs/business-console.md`，把当前主线从 Episode 文档包工作台改为 Writing Job 文本生产系统。
- [x] 1.2 更新 `doc-maker/ui/README.md`，声明新路由/组件的产品契约：Job Spec、Precheck、Eval、Skill Package lifecycle。
- [x] 1.3 更新 `doc-maker/docs/07-acceptance.md`，增加 Writing Job / Precheck / Eval / Skill Package 发布的验收基线。
- [x] 1.4 新增 ADR 或 addendum，记录从 doc package generator 调整为 writing production system。

## 2. UI 信息架构

- [x] 2.1 将 L1 首页从 Episode 列表改为 Writing Job 工作台。
- [x] 2.2 增加 Job Spec 创建区，支持目标、底稿、写法参考、评审偏好四类输入。
- [x] 2.3 增加 Precheck 结果区，展示 Content Brief、Writing Rules Candidate、Eval Profile、Risk List。
- [x] 2.4 在 Precheck 结果中提示“已自动生成本轮评分标准”，并允许展开查看规则。

## 3. 生成与评估闭环

- [x] 3.1 增加多篇候选 Draft mock 数据，展示标题、摘要、正文片段、自动评分。
- [x] 3.2 展示 Eval Profile 的 score breakdown：基础质量、任务匹配、风格偏好、风险扣分。
- [x] 3.3 增加选中文本轻反馈，并让反馈进入 Feedback Ledger / Rule Patch，不直接覆盖旧候选或已发布 Skill Package。
- [x] 3.4 增加 Rule Patch 草稿池上限与 Rule Snapshot active rules 上限。
- [x] 3.5 展示相似表达和事实漂移风险，避免“仿写”被误解为复制句子。

## 4. Rule-to-Skill Package 生命周期

- [x] 4.1 展示 Writing Rules Candidate 当前版本、来源、适用范围、禁忌和检查表。
- [x] 4.2 增加 Skill Package 状态说明：candidate / ready-to-publish / published / blocked。
- [x] 4.3 明确当前 baseline 不发布 Published Skill Package，只保留 Writing Rules Candidate / Rule Snapshot 闭环。
- [x] 4.4 明确技术导出（Codex/Claude `SKILL.md`）是高级动作，不出现在普通流程里。

## 5. 验证

- [x] 5.1 运行 `openspec validate add-writing-production-system`。
- [x] 5.2 在 `doc-maker/ui` 运行 `pnpm typecheck`。
- [x] 5.3 在 `doc-maker/ui` 运行 `pnpm build`。
- [x] 5.4 浏览器检查首页：用户能看懂输入什么、Precheck 产出什么、为什么 Eval Profile 第一轮不为空。

## 6. 抽象上移兼容

- [x] 6.1 明确“源材料生成结构化讲解文档包”不是删除，而是默认 `Output Profile`。
- [x] 6.2 在首页 Job Spec 中展示 `structured explanation package` 输出档案。
- [x] 6.3 在 OpenSpec / ADR / README / 验收文档中去掉“砍掉旧设计”的误读空间。

## 7. Manual Rule Scope 初始化层

- [x] 7.1 在 Start Context 中保留一个 Quick Intake 输入和一个可选 Reference Paste 输入，不做 Source Store / RAG。
- [x] 7.2 新增 Writing Rule Scope 数据结构：结构、语气、禁忌、检查点、source note、confidence。
- [x] 7.3 从 Quick Intake + Reference Paste 生成 Writing Rule Scope，并允许用户删除 scope 项。
- [x] 7.4 确认 Writing Rule Scope 后生成 Baseline Stack，再进入 Job Spec / Precheck。
- [x] 7.5 新增 Scope extraction eval，只评估参考片段到规则范围的提炼质量。

## 8. TraceSink 基础设施

- [x] 8.1 新增 `LLMCallTraceRecord`，记录 provider、model、prompt version、input refs、output artifact、eval result、run id、node type。
- [x] 8.2 新增 `TraceSink` 抽象，当前默认写入本地 JSON run record，Langfuse 作为后续 sink。
- [x] 8.3 将 scope extraction、precheck normalization、candidate generation、feedback reasoning、rule patch compilation 挂到 `FrameworkNodeRunRecord.llmCalls`。
- [x] 8.4 在 L1 只读详情中展示 TraceSink / LLM Calls，方便确认前置 LLM 已进入统一 trace contract。

## 9. L2 Framework Run Viewer

- [x] 9.1 新增 `/framework`，读取本地 `.writing-runs` 并选择最近 run。
- [x] 9.2 展示 NodeRun timeline、TraceSink contract check、LLM call records 和 latest trace payload。
- [x] 9.3 从 L1 只读详情和 `/hub` 增加 Framework Viewer 入口。

## 10. LLM Runtime Settings

- [x] 10.1 新增 `/settings/llm`，支持 `mock / ollama / openai-compatible` runtime 配置。
- [x] 10.2 新增 `LLMRuntimeSettings` 本地配置存储；API Key 只从 env 读取，不写入页面或本地 JSON。
- [x] 10.3 新增 runtime Test Call API，成功和失败都写入 `LLMCallTraceRecord`。
- [x] 10.4 将真实 LLM 首先接入 `Writing Rule Scope`，Candidate 暂保留 deterministic runtime。
- [x] 10.5 在 L1 和 `/framework` 提供 LLM settings 入口或 provider 状态提示。
- [x] 10.6 新增模型发现 API 与设置页模型列表，支持从 Ollama / OpenAI-compatible runtime 加载可用模型并选择。
- [x] 10.7 在 L1 Writing Rule Scope 结果中展示 provider、model、prompt version、trace id 和 latency，让真实调用对业务用户可感知。
- [x] 10.8 在 L1 最近 run 面板增加“新建 Job”，只重置当前页面草稿，不删除历史 run record。
- [x] 10.9 将真实 LLM 接入 Precheck Normalization，输出 Content Brief / Grounding Brief / Writing Rules Candidate / Risk List，并在 L1 展示 provider、model、trace、latency。
- [x] 10.10 增加真实 LLM 调用状态体验：L1 显示当前运行节点、预计耗时、停止等待、重跑 Precheck 说明；Framework 显著标识 failed/fallback trace。

## 11. 架构边界收口

- [x] 11.1 暂停 Candidate Guard / regression fixtures 扩展，把下一步调整为边界收口。
- [x] 11.2 将 framework trace 组装从 `writing-runtime.ts` 拆到 `writing-framework-trace.ts`，避免业务 runtime 承担诊断层职责。
- [x] 11.3 同步 ADR / README / business-console / OpenSpec design，明确 TraceSink 不是自研 Langfuse，`/framework` 不是业务工作台。

## 12. Core Eval 最小实现

- [x] 12.1 新增 `workflow-core/eval.ts`，定义 deterministic Eval runner、dimension、candidate result、attribution。
- [x] 12.2 新增 `writing-eval-adapter.ts`，把 Writing Candidate breakdown 映射到 core eval，再转回现有 L1 EvalRun。
- [x] 12.3 将 Candidate FrameworkNodeRun 的 evalRuns 改为读取 core eval attribution，而不是硬编码通过。
- [x] 12.4 使用 API 跑通 Scope/Precheck 后的 Candidate -> Eval -> Feedback -> RulePatch -> Next Batch 闭环。

## 13. 竞品结论落地（下一步）

- [x] 13.1 实现 Rule Scope “应用规则 / 不应用规则” A/B 对照预览，同一 Job Spec 下对比规则影响。
- [x] 13.2 引入 Rule Package 命名边界：区分 Writing Rule Scope、Rule Package、Published Skill Package。
- [x] 13.3 在 Scope / Precheck 风险中展示来源覆盖率、未覆盖来源和过度仿写风险，高风险阻断发布。
- [x] 13.4 将历史 Job Feedback Ledger 沉淀为 dataset draft，人工确认后再进入正式 eval dataset。
- [x] 13.5 暂不做 Source Store / RAG / workflow builder；当前继续使用 Reference Paste 与既有 trace/eval 闭环。

## 14. 输出契约与规则来源边界修正

- [x] 14.1 将全局 baseline 从“短视频口播 300-500 字”改为 Auto 文本产物，不预设字数、口播、TTS 或分镜内容规则。
- [x] 14.2 将默认 Output Contract 置空；产物类型、长度范围、写法参考不再由系统静默预设。
- [x] 14.3 保留流程 baseline：Intake -> Rule Scope -> Precheck -> Candidate -> Eval -> Feedback -> Snapshot。
- [x] 14.4 建立规则来源互斥：无模板时 Rule Scope LLM 自动提炼；复用模板时不自动提炼规则。
- [x] 14.5 输入契约只保存用户确认字段；Rule Scope / Precheck 生成内容必须标记为 LLM 派生，不静默反写左侧字段。

## 15. Draft Job 持久化

- [x] 15.1 点击“生成规则范围”成功后创建/更新 `draft_scope_ready` run，刷新后不丢失。
- [x] 15.2 Scope extraction trace 绑定 draft run id，避免 Langfuse / local trace 变成 adhoc。
- [x] 15.3 确认规则范围时复用同一个 draft run id，升级为 `precheck_ready`。
- [x] 15.4 All Jobs / 草稿视图展示 Draft Job，但不把它混成正式 Precheck/Review 任务。
