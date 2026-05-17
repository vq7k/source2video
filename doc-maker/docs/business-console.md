# Business Console（Writing Production / L1）

> **位置**：`business-console.md`。**业务层 UI 设计**。当前主线已从“结构化讲解文档包生成工作台”调整为 **Writing Job 文本生产系统**（见 [ADR-028](ADRs/028.md) / OpenSpec `add-writing-production-system`）。
>
> 配套：[`ADRs/027.md`](ADRs/027.md)（业务产品原型成为主线）、[`06-ui-spec.md`](06-ui-spec.md)（L2/L3 诊断层）、[`07-acceptance.md`](07-acceptance.md)（当前验收基线）。

---

## 当前产品定位

doc-maker 是把混乱素材、参考写法和评审偏好转成可批量生成、可评分、可迭代沉淀的文本生产系统。

这是对原设计的抽象上移，不是删除原设计：`plan / scripts / shots / visual_spec / qa_report` 继续作为默认 `Output Profile` 存在。

一句话抽象：

> 输入是不稳定的原始素材和条件规则；输出是多篇候选文本；系统用固定 Precheck + Eval 闭环把写法沉淀为可发布 Skill Package 的写法规则资产。

主流程：

```text
Raw Input
  -> Start Context（Manual Rule Scope）
  -> Quick Intake + optional Reference Paste
  -> Writing Rule Scope（用户删减/确认）
  -> Baseline Stack
  -> Job Spec + Output Contract
  -> Precheck
  -> Content Brief + Writing Rules Candidate + Eval Profile + Risk List
  -> Candidate Run（默认 3 个版本）
  -> Auto Eval + Human Selection Feedback
  -> Feedback Ledger + Rule Patch Drafts（最多 5 条，超出合并）
  -> Next Generation Run + Rule Snapshot（最多 10 条 active rules）
  -> Finalize Export
```

“讲解文档包”仍是首个输出场景，但不再锁死产品本质。

---

## 1. L1 产品契约

L1 默认只暴露写作生产概念，不暴露 prompt、agent、schema、节点或内部 trace。

| 概念 | 用户看到什么 | 不展示什么 |
|---|---|---|
| Writing Job | 本次要写什么、给谁看、发在哪里 | workflow/node |
| Job Spec | 目标、底稿、写法参考、评审偏好 | 内部 JSON schema |
| Output Profile | 结构化讲解文档包、普通长文、决策复盘等交付形态 | 单一硬编码产物 |
| Precheck | Content Brief、Writing Rules Candidate、Eval Profile、Risk List | prompt 拼装过程 |
| Candidate Draft | 多篇候选、自动评分、选中文本反馈 | 单次 LLM call |
| Published Skill Package | ready-to-publish / published / blocked | Codex/Claude `SKILL.md` + scripts/assets/tests 等标准能力包格式 |

核心原则：

1. 动态输入必须先归一为 Job Spec。
2. 具体交付形态必须通过 Output Profile 表达；结构化讲解文档包是默认档案。
3. Precheck 是生成前必经环节。
4. 第一轮 Eval Profile 不为空，由系统自动生成，用户可展开修改。
5. 人工反馈只进入 Feedback Ledger 和 Rule Patch，不直接覆盖旧候选或 Published Skill Package。
6. 相似表达和事实漂移风险必须可见。
7. 规则草稿有容量上限：本轮 draft 最多 5 条，active snapshot 最多 10 条规则。
8. 候选评审和最终定稿分开：评审负责反馈和下一批，定稿负责选择和导出。

---

## 2. Job Spec 创建区

Job Spec 是系统初始化写作环境的入口。当前版本提供 **baseline 功能**：字段集合、默认 Output Profile、Precheck 产物类型和第一轮 Eval 维度都由系统内置；用户可以编辑本轮内容和 Precheck 产物，但暂不支持在 UI 中新增字段、规则类型或风格类型。新增结构能力需要修改代码。

这套 baseline 不是 prompt 拼装表单，而是基于 LLM 写作生产的初始任务契约。它引用的方法论如下：

| 方法论 | 对 Job Spec 的作用 |
|---|---|
| Creative Brief | 把目标、受众、关键信息、交付物和约束收束成任务书 |
| Grounding | 要求输出绑定底稿、事实来源和证据缺口，降低幻觉 |
| Structured Outputs | 把交付物定义成稳定 Output Profile，而不是自由文本 |
| Few-shot / Reference Method | 用示例文章、账号风格或外部写作方法包 约束写法模式 |
| Eval-driven Development | 先定义评分标准，再批量生成、比较和迭代 |

首屏创建区保留五类 baseline 输入：

| 输入 | 用途 | 示例 |
|---|---|---|
| 问题定义 | 本轮写作要解决什么沟通任务 | “给主管解释为什么产品线从框架优先转向文本生产闭环” |
| 底稿 | 事实、观点、链接、转录稿、旧笔记 | 会议纪要、视频转录、素材摘录 |
| 交付 | 输出档案或文本形态 | 结构化讲解文档包、长文、决策复盘 |
| 写法参考 | 示例文章、账号风格、外部写作方法包 | 专业作家文章、公众号爆款结构 |
| 评审偏好 | 主管要求、禁忌、历史打分偏好 | “不要鸡汤，不要夸张标题” |

默认 Output Profile：

| 档案 | 产物 |
|---|---|
| structured explanation package | `plan / scripts / shots / visual_spec / qa_report` |

默认 Output Contract：

| 字段 | baseline |
|---|---|
| artifactType | short explanatory text |
| lengthRange | 300-500 中文字（约 60-90 秒口播基准） |
| structure | 标题 + 判断开场 + 2-3 个短论证段 + 下一步 |
| downstreamHandoff | TTS / Video 是下游节点，不在本节点生成视觉指导或 TTS 文本 |

用户可以只填标题或话题；缺失信息进入 Precheck Risk List，而不是阻断创建。

### 2.1 Manual Rule Scope 初始化层

当前阶段不做完整 `Source Store / RAG / 多文件导入`。它们会引入检索质量、chunk 策略、权限、provenance 和额外 eval，当前复杂度过高。

已实现最小初始化层：

```text
一句话想法
+ 可选参考片段粘贴
  -> LLM 提炼 Writing Rule Scope
  -> 用户删减 / 确认
  -> Baseline Stack
  -> Job Spec / Precheck
```

| 输入 | 作用 | 当前边界 |
|---|---|---|
| Quick Intake | 描述本轮想做什么 | 必填，单入口 |
| Reference Paste | 粘贴一小段参考文章、转录稿或历史规则 | 可选，不做文件库 |
| Writing Rule Scope | 本轮可用写法范围：结构、语气、禁忌、检查点、source note | 临时候选，不是 Skill Package |
| Baseline Stack | Job Spec schema、Output Contract、Eval Profile seed、Precheck rules | 系统内置，可由 scope 影响 |

只新增一个 eval 面：

| Eval | 评估对象 | 目的 |
|---|---|---|
| Scope extraction eval | Reference Paste -> Writing Rule Scope | 检查提炼规则是否准确、是否过度仿写、是否遗漏禁忌 |

保留现有 Job Eval；暂不做检索 eval、RAG 召回 eval、Source Store provenance eval。

代码边界：

| 对象 | 当前实现 |
|---|---|
| LLM 调用 | `lib/llm/*` 支持 mock / Ollama / OpenAI-compatible；Scope / Precheck / Candidate / Feedback / Rule Patch 共用统一 provider |
| 本地数据 | `lib/run-store.ts` 写 `.writing-runs/*.json` |
| Core Eval | `workflow-core/eval.ts` 提供业务无关 deterministic EvalRun / Attribution runner |
| 框架层记录 | `FrameworkNodeRunRecord` 记录 `NodeRun / Artifact / EvalRun` |
| TraceSink | `LLMCallTraceRecord` 记录 provider、model、prompt version、input refs、output artifact、eval result、run id、node run id、node type；当前落本地 JSON |
| Writing eval adapter | `writing-eval-adapter.ts` 把 Candidate 分数映射为 core eval，再转回 L1 展示结构 |
| Framework trace builder | `writing-framework-trace.ts` 只负责把业务事件映射为 NodeRun / LLM call 诊断记录 |
| 业务 runtime | `writing-runtime.ts` 只负责 Scope、Precheck、Candidate、Feedback、Rule Snapshot 的业务状态流 |
| L1 页面 | 只展示业务对象；API 调用集中在 `writing-run-client.ts` |
| LLM Runtime Settings | `/settings/llm` 配置 provider、base URL、model；可加载模型；API Key 只读 env |

当前只做框架层 eval loop 的最小本地闭环，不做 DAG、RAG、真实 judge 或回归测试集。前置 LLM-like step 必须先进入统一 TraceSink，再同步到 Langfuse。真实 LLM 已接入 `Writing Rule Scope`、`Precheck Normalization`、`Candidate Generation`、`Feedback Reasoning`、`Rule Patch Compilation`；候选评分通过 `workflow-core/eval.ts` 产出 core eval，再由 Writing adapter 映射到业务页。TraceSink 是适配边界，不是自研 Langfuse；`/framework` 是诊断入口，不是新的业务工作台。

---

## 3. Precheck 结果区

Precheck 固定产出四块：

| 输出 | 定义 | 生命周期 |
|---|---|---|
| Content Brief | 本期事实、观点、受众、渠道、约束、缺口 | 单次 Job 使用 |
| Writing Rules Candidate | 结构、节奏、语气、论证动作、检查表、禁忌 | 可迭代候选资产 |
| Eval Profile | 本轮临时评分标准 | 本轮使用，稳定后可沉淀 |
| Risk List | 相似表达、事实漂移、证据缺口、偏好冲突 | 每轮都展示 |

页面必须明确提示：

> 已根据目标、素材、参考写法自动生成本轮评分标准。

Eval Profile 默认折叠，但可展开查看基础质量、任务匹配、风格偏好和风险扣分规则。

---

## 4. 候选评审、反馈账本与定稿

确认 Precheck 后才进入批量生成。一次 Writing Job 默认产出 3 篇 Candidate Draft，而不是一个“最终答案”。

每篇候选必须展示：

- 标题、摘要、正文片段。
- 自动总分。
- score breakdown：基础质量、任务匹配、风格偏好、风险扣分。
- 简短评分理由。
- 相似表达和事实漂移风险。

默认人工交互必须尽量轻：用户在阅读区选中文本，点击“喜欢 / 不满意 / 需要改写”等标签。系统把选中文本、Job Spec、Eval Profile 和候选版本作为上下文，自动归因并写入 Feedback Ledger。

Feedback Ledger 与处理队列分开：

| 区域 | 含义 |
|---|---|
| Feedback Ledger | 所有人工反馈账本，包含已编译和待处理 |
| 待处理反馈 | 尚未进入 Rule Patch 的反馈 |
| Rule Patch Drafts | 从反馈编译出的规则草稿，最多 5 条，同类反馈自动合并 |
| Rule Snapshot | 运行下一批时生成的 active rule 集合，最多 10 条规则 |

点击反馈标签只生成规则草稿，不立即重跑候选。用户点击“运行下一批”后，系统才应用 draft rule patch，生成新的 Rule Snapshot、Generation Run 和候选版本。旧候选冻结保存，不因规则更新被改写。

最终定稿是独立步骤：只展示本批候选阅读卡，用户选择 1 个 Text Artifact 后导出。本页不再录入规则反馈。

### 4.1 观测入口与状态保留

L1 只提供业务可理解的观测入口，不把 Framework / Langfuse 概念前置给普通流程。

| 入口 | 位置 | 带入上下文 |
|---|---|---|
| 观测 | 右侧 Inspector 顶部 | `runId + stage + returnTo` |
| 候选观测 | 当前候选阅读区 | `runId + candidateId + nodeRunId + traceId + returnTo` |
| 异常观测 | 失败、fallback、评分异常处 | `runId + nodeRunId + traceId + returnTo` |

返回 L1 时必须恢复用户原来的 `runId / stage / candidateId`。不能因为进入 `/framework` 再返回就丢失当前候选、当前阶段或列表位置。

---

## 5. Rule-to-Skill Package 生命周期

Writing Rules Candidate 是本轮规则候选，不是 prompt，也不是标准 Skill。Skill Package 才是可发布、可安装、可测试的能力包。

| 状态 | 含义 | 允许动作 |
|---|---|---|
| candidate | 从当前 Job 的参考和反馈中抽取 | 继续迭代、阻断发布 |
| ready-to-publish | 分数、风险、证据达到阈值 | 发布、补版本说明 |
| published | 可被未来 Writing Job 复用 | 作为写法输入选择 |
| blocked | 相似表达、事实漂移或证据不足 | 修复风险、继续打分 |

发布前证据至少包括：轮次、自动分、人工反馈收敛情况、风险状态、版本说明、适用范围。

技术导出（Codex/Claude `SKILL.md`）是高级动作，只能从已发布 Skill Package 生成，不出现在普通编辑流程中。

当前 baseline 原型只做到 Writing Rules Candidate / Rule Snapshot 的本地闭环，暂不支持 UI 发布 Published Skill Package。

---

## 6. L2/L3 关系

L1 是写作生产控制台；L2/L3 仍是诊断层。

- L1 跑通时，用户不需要理解节点。
- Precheck 或 Eval 异常时，可跳到 L2/L3 查看 trace、materials、attribution。
- L2/L3 不反向污染 L1，不把内部 schema 推给业务用户。
- `/framework` 是当前真实 run 诊断入口：读取本地 `.writing-runs`，展示 NodeRun timeline、TraceSink / LLM call contract 和最新 trace payload。
- `/settings/llm` 是当前模型 runtime 配置入口：只保存 provider、base URL、model；可从 Ollama / OpenAI-compatible runtime 加载模型；不保存 API Key。

---

## 7. 不允许的设计

| 反模式 | 为什么不许 |
|---|---|
| 让用户直接写 prompt 或内部 schema | 动态输入会失控，必须归一为 Job Spec |
| 第一轮 Eval 规则为空 | 无法比较候选，人工反馈也无法归因 |
| 直接把参考文章发布成 Skill Package | 会污染资产库，且有过度仿写风险 |
| 只生成一篇“最终稿” | 失去比较、评分和迭代闭环 |
| 用人工总分按钮替代阅读反馈 | 交互过重，无法解释具体不满意片段 |
| 反馈后还要求二次确认规则草稿 | 已点击反馈却还要确认一次，增加无效操作 |
| 人工反馈直接改 Published Skill Package | 主管偏好不稳定，必须先进入 candidate |
| 普通流程暴露 `SKILL.md` | 技术导出不是产品主体验 |

---

## 8. 当前实施时机

- **当前状态**：进入 Writing Production 产品原型主线。
- **实施目标**：用本地可执行闭环验证“用户输入什么、Precheck 产出什么、Eval 为什么第一轮不为空、反馈如何进入规则草稿、定稿如何导出”。
- **不代表**：真实相似度检测、真实 Skill Package 发布仓库已经接入。

## 9. Product Backlog

- [ ] 研究独立可发布定位：doc-maker 是否应面向专业内容创作者，帮助其把个人写作经验、参考素材和评审偏好工程化为可复用、可测试、可迭代的文本生产流水线。
- [ ] 实现 Manual Rule Scope 初始化层：Quick Intake + Reference Paste -> Writing Rule Scope -> Baseline Stack，不接 Source Store / RAG。
