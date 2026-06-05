# doc-marker 竞品调研

> 初版调研范围：Writing Production 文本生产系统。资料优先使用官方产品页、帮助文档和开发文档；未做付费试用，不把营销话术当作已验证事实。

## 1. 结论

doc-marker 不适合定位成通用 AI 写作工具，也不适合复制企业营销平台。更准确的位置是：

> 帮助专业内容创作者把个人写作工作流工程化：把素材、参考写法、评审偏好和人工反馈转成可生成、可评分、可复盘、可沉淀的写作规则资产。

这个位置避开 Jasper / Typeface / Copy.ai 的企业营销全链路竞争，也避开 Langfuse / Braintrust / Humanloop 的纯 LLMOps 平台竞争。

## 2. 竞品地图

| 类别 | 代表产品 | 已验证能力 | 对 doc-marker 的启发 |
|---|---|---|---|
| 企业营销内容平台 | Jasper / Copy.ai / Typeface / Writer | Brand Voice、知识库、GTM 工作流、品牌上下文、多渠道内容 | 证明“写法资产 + 工作流”有市场，但范围很重 |
| 写作辅助工具 | Grammarly / Sudowrite | 语气规则、风格反馈、Story Bible、Canvas | 证明“写作上下文 SOT”重要，但缺少 eval 闭环 |
| LLMOps / Eval 平台 | Langfuse / Braintrust / Humanloop / PromptLayer | trace、scores、datasets、experiments、human/AI/code evaluator | 这些能力应接入，不应重做 |
| Agent / Workflow / Skill | Dify / Claude Skills / Codex Skills | 工作流编排、DSL、SKILL.md、resources、scripts、测试 | Skill Package 必须自包含，不能只是提示词 |

## 3. 单品观察

### Jasper

Jasper 的 Brand Voice 可以从用户提供的文本、文件或 URL 中分析语气和风格；还支持预览“应用 brand voice”和“不应用 brand voice”的生成差异。它的价值点不是单次生成，而是让团队在不同入口保持品牌一致。

对 doc-marker 的借鉴：

- Rule Scope 应该支持“应用规则 / 不应用规则”的 A/B 对照。
- 参考文本提炼出的规则需要可读、可删、可预览。
- 不要把“风格”直接当成已发布资产，必须经过 eval 和人工确认。

### Copy.ai

Copy.ai 已从 copywriting 工具转向 GTM AI Platform，强调 Chat、Brand Voice、Infobase、Workflows、Forms、API。它的内容工具围绕销售、ABM、活动、SEO、转录稿转内容等 GTM 场景组织。

对 doc-marker 的借鉴：

- “模板集合”不是核心壁垒；场景化工作流才有价值。
- doc-marker 的短期场景不应扩成 GTM，而应聚焦“短文 / 短视频脚本 / 专业解释文本”的生产闭环。

### Typeface

Typeface 的 Arc 把品牌上下文、Agent、空间协作和自定义 Agent builder 组合成企业营销编排平台，覆盖 planning、creation、review、approval、publishing。

对 doc-marker 的借鉴：

- 全链路平台会很重，当前不要做 campaign / approval / publishing。
- 可以借鉴“Graph / Agents / Spaces / Forge”的分层：上下文资产、执行节点、工作区、扩展能力分开。

### Writer

Writer 以企业 AI Studio、Palmyra 模型和 Knowledge Graph 为核心，强调把企业数据接入 agent 和 RAG。它解决的是企业知识与治理，不是个人写作偏好迭代。

对 doc-marker 的借鉴：

- Source Store / RAG 是后续能力，不应在当前 L1 过早引入。
- 一旦做 RAG，需要额外 eval：召回覆盖、来源可信度、provenance、检索漂移。

### Grammarly

Grammarly 的 Brand Tones 允许组织定义 on-brand / off-brand tone，并用解释说明影响写作反馈。它更像实时写作质量和风格约束层。

对 doc-marker 的借鉴：

- Eval Profile 可以借鉴 on-brand / off-brand 表达，但要服务“本轮生成标准”，不是通用语法检查。
- 反馈标签应该尽量轻，不应让用户填写长表单。

### Sudowrite

Sudowrite 的 Story Bible 把长篇故事中的角色、世界观、风格、场景等作为项目级 source of truth；Canvas 支持卡片式构思和大纲整理。

对 doc-marker 的借鉴：

- 对长内容，必须有“项目记忆 / 本轮契约”的分层。
- 当前短文 baseline 不需要复杂 Canvas，但需要明确“本轮 Job Spec”是唯一输入契约。

### Langfuse

Langfuse 的 eval 概念覆盖 datasets、scores、experiments、online evaluation、annotation queues。它已经是 trace / score / experiment 的 SOT。

对 doc-marker 的借鉴：

- `/framework` 只能做 Langfuse Lens，不做自研日志中台。
- 业务页只展示摘要和深链；trace、score、experiment 回到 Langfuse。
- 历史 Job 后续可以沉淀为 dataset items。

### Braintrust / Humanloop / PromptLayer

Braintrust 强调 immutable experiment snapshot；Humanloop 把 Evaluator 分为 AI / code / human；PromptLayer 组合 Prompt Registry、Datasets、Evaluations、Observability、Workflows。

对 doc-marker 的借鉴：

- 当前 deterministic eval 是正确的第一步，LLM judge 应后置。
- 人工反馈不是“评分按钮”，而是 evaluator 信号之一。
- 规则变更必须形成 snapshot，旧候选不可被重写。

### Dify

Dify 证明低代码 workflow、RAG、模型管理、日志分析有成熟产品形态。但它是 AI 应用构建平台，不是写作规则资产管理工具。

对 doc-marker 的借鉴：

- 不要先做通用 workflow builder。
- 框架层可以学习 node-level run / trace / token / latency，但 L1 必须保持业务语言。

### Claude Skills / Codex Skills

Claude Skills 官方结构要求至少有 `SKILL.md`，可加入 resources 和 scripts，也强调测试、打包、安全注意事项。Skills 可以很简单，也可以是多文件、可执行能力包。

对 doc-marker 的借鉴：

- Writing Rule Scope 不是 Skill。
- Published Skill Package 才能对应 `SKILL.md + resources + scripts + tests`。
- 当前产品应先沉淀 Rule Package，再后置技术导出。

## 4. 产品机会

竞品缺口集中在一条线上：

> 内容创作者知道“哪里不对”，但这些判断通常散落在聊天、批注、主管口头意见、示例文章和临时 prompt 里，无法稳定复用、评估和回滚。

doc-marker 的机会不是更快生成，而是把这条链工程化：

```text
参考材料 / 一句话想法
  -> Job Spec
  -> Precheck
  -> 多候选生成
  -> Auto Eval
  -> 选中文本轻反馈
  -> Rule Patch
  -> Rule Snapshot
  -> 下一轮候选
  -> Published Skill Package
```

## 5. 设计原则

| 原则 | 说明 |
|---|---|
| 业务优先 | L1 不暴露 prompt、trace、schema、node |
| 规则可读 | 所有 LLM 提炼出的规则都必须可读、可删、可追溯来源 |
| Eval 先行 | 第一轮 Eval Profile 不为空，否则候选无法比较 |
| 历史不可改写 | 规则更新不覆盖旧候选，只生成新快照和新批次 |
| 平台不重做 | Langfuse / eval platform 的能力接入，不在 L1 复制 |
| Skill 后置 | Skill Package 是发布资产，不是当前轮 prompt |

## 6. 已采纳与待实现状态

本轮调研结论已采纳为产品需求，但不代表 UI 已实现。

| 状态 | 动作 | 落地位置 |
|---|---|---|
| 已采纳，待实现 | 增加“应用规则 / 不应用规则”Rule Scope A/B 对照 | `business-console.md` §2.2，`tasks.md` §13.1 |
| 已采纳，待实现 | 把历史 Job 反馈转成 eval dataset draft | `business-console.md` §4，`tasks.md` §13.4 |
| 已采纳，待实现 | 明确 Rule Package 与 Skill Package 的命名边界 | `business-console.md` §5，`tasks.md` §13.2 |
| 已采纳，待实现 | 为 Rule Scope 增加来源覆盖率和过度仿写风险 | `business-console.md` §2.2，`tasks.md` §13.3 |
| 后置 | Published Skill Package 导出预览 | 等 Rule Package 稳定后再做 |
| 暂缓 | Source Store / RAG / workflow builder | 当前仍不进入 L1 范围 |

## 7. 信息源

- Jasper Brand Voice Help: <https://help.jasper.ai/hc/en-us/articles/18618693085339-Brand-Voice>
- Copy.ai Platform Overview: <https://support.copy.ai/en/articles/10059160-platform-overview>
- Copy.ai GTM AI Tools: <https://gtm.copy.ai/>
- Typeface official product page: <https://www.typeface.ai/>
- Writer AI Studio: <https://writer.com/product/ai-studio/>
- Writer Knowledge Graph help: <https://support.writer.com/article/242-how-to-create-and-manage-a-knowledge-graph>
- Grammarly Brand Tones: <https://support.grammarly.com/hc/en-us/articles/4403544890253-Set-brand-tones>
- Sudowrite Story Bible: <https://docs.sudowrite.com/using-sudowrite/1ow1qkGqof9rtcyGnrWUBS/what-is-story-bible/jmWepHcQdJetNrE991fjJC>
- Sudowrite Canvas: <https://docs.sudowrite.com/using-sudowrite/1ow1qkGqof9rtcyGnrWUBS/canvas/pQGLNzeYo1kLhGo14rdBy6>
- Langfuse Evaluation Concepts: <https://langfuse.com/docs/evaluation/concepts>
- Langfuse Experiments via SDK: <https://langfuse.com/docs/evaluation/experiments/experiments-via-sdk>
- Braintrust Experiments: <https://www.braintrust.dev/docs/evaluate/run-evaluations>
- Humanloop Evaluators: <https://humanloop.com/docs/v4/evaluators>
- Humanloop Evaluation UI: <https://humanloop.com/docs/guides/evals>
- PromptLayer Documentation: <https://docs.promptlayer.com/>
- PromptLayer Evaluation: <https://docs.promptlayer.com/onboarding-guides/evaluation>
- Dify Workflow announcement: <https://dify.ai/blog/dify-ai-workflow>
- Dify Logs documentation: <https://docs.dify.ai/en/use-dify/monitor/logs>
- Claude custom Skills: <https://support.claude.com/en/articles/12512198-how-to-create-custom-skills>
- Claude Agent Skills docs: <https://docs.claude.com/en/docs/agents-and-tools/agent-skills>
