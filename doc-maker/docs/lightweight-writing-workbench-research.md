# 轻量文本生成台竞品调研

> 时间：2026-05-18  
> 范围：围绕新的 L1 轻量写作工作台重新调研。目标不是完整 Writing Production 后台，而是“开箱即用、最快出结果”的业务入口。
> 2026-05-21 同步：`/writing` 对外文案从“写作”收敛为“文本生成”；规则包、Source Store、Workflow Builder 不进入当前 L1 默认交互。

## 1. 一句话结论

轻量文本生成台不应先做任务管理、规则管理或 Chat 客户端，而应做：

> 用户输入一句文本任务或一段材料，系统自动理解输入边界并生成 3 个可比较版本；用户用轻反馈推动下一轮收敛，规则资产沉淀后置到 L2/L3。

竞品共同证明两点：

1. Chat / Canvas 适合快速协作和局部修改，但不天然形成可复用规则资产。
2. Brand Voice / Infobase / Knowledge Graph 能维持上下文一致，但通常设置重、偏企业后台，不适合作为 L1 起点。

doc-marker 的 L1 机会是把二者中间的空白补上：**比 Chat 更结构化，比企业营销平台更轻。**

## 2. 竞品地图

| 类别 | 代表产品 | 核心入口 | 对轻量 L1 的启发 | 不照搬 |
|---|---|---|---|---|
| Chat / Canvas 写作面 | ChatGPT Canvas / Gemini Canvas / Claude Artifacts | 对话 + 右侧编辑面 | 单输入、局部选中修改、快速出稿 | 不把主流程做成无限 Chat |
| Brand Voice / Style | Jasper / Copy.ai / Grammarly / Claude Styles | 上传样例或配置风格 | 写法资产需要可复用、可预览、可开关 | 不让用户先建复杂风格库 |
| 企业写作/Agent 平台 | Writer / Copy.ai Workflows | Agent / workflow / knowledge base | 重复任务需要结构化输入输出 | 不做 workflow builder |
| 创意写作系统 | Sudowrite Story Bible / Canvas | 项目记忆 + 可视化构思 | 长内容需要 source of truth | 当前短文不做复杂画布 |
| Eval / Observability | Langfuse / Braintrust / Humanloop | trace / score / dataset | 规则和反馈需要可追溯 | 不在 L1 展示内部机制 |

## 3. 单品观察

### 3.1 ChatGPT Canvas / Gemini Canvas / Claude Artifacts

这些产品都在解决同一个问题：普通 Chat 的输出太临时，写作和修改需要一个稳定的工作面。

- ChatGPT Canvas 支持写作/代码项目、选中文本让模型聚焦、直接编辑、调整长度和恢复版本。
- Gemini Canvas 强调在一个空间里写作、编码和创建，支持生成草稿、调整语气、细调片段和反馈。
- Claude Artifacts 把生成内容放到右侧独立窗口，并支持从对话产生不同版本。

对 doc-marker 的判断：

- 可以借鉴“单输入 + 结果区 + 选中文本反馈”。
- 不应把 L1 变成 Chat 客户端。Chat 会让输入持续动态化，削弱我们“输入契约 -> 多版本 -> 反馈 -> 规则沉淀”的主线。
- L1 可以保留局部 Chat-like 交互：选中文本后自动分析“不满意原因”。

### 3.2 Jasper Brand Voice

Jasper Brand Voice 支持上传文本、文件或 URL 来分析写作声音，并能预览应用 Brand Voice 与不应用 Brand Voice 的差异。

对 doc-marker 的判断：

- “规则是否真的有效”应该可对照，所以 Rule Scope 后续值得支持 A/B：应用规则 vs 不应用规则。
- 但 Jasper 的入口仍偏“先建资产再使用”。我们的 L1 应该反过来：先出结果，满意后再提示沉淀规则包。

### 3.3 Copy.ai Brand Voice / Infobase / Workflows

Copy.ai 把 Chat、Brand Voice、Infobase、Workflows 和 API 组合成 GTM 平台。Infobase 让团队保存品牌、产品、受众等资料，再通过标签在生成时引用。

对 doc-marker 的判断：

- 信息复用是必要能力，但 L1 不应先暴露知识库和工作流。
- 当前 L1 暂不暴露规则来源选择；规则来源、规则包复用和规则资产沉淀后置到 L2/L3。
- Source Store、RAG、Workflow Builder 都应该后置到 L2/L3 或后续版本。

### 3.4 Grammarly Brand Tones / Style Guide

Grammarly 通过 Brand Tones、Style Guide、Snippets 让团队写作保持风格一致，并用建议形式嵌入到真实写作场景。

对 doc-marker 的判断：

- 规则反馈应该轻量嵌入阅读过程，而不是要求用户填完整评分表。
- “是否符合偏好”可以表现为提示和标签，不必让用户理解 eval 维度。
- L1 最小交互应是：选择候选、选中文本、点标签、继续生成。

### 3.5 Sudowrite Story Bible / Canvas

Sudowrite 的 Story Bible 是项目级 source of truth，用来保存故事设定、角色、世界观、风格、场景等；Canvas 是视觉化卡片和大纲空间。

对 doc-marker 的判断：

- 对长文/系列内容，项目记忆很重要。
- 当前短视频短文 baseline 不需要 Canvas。否则 L1 会从“出结果”变成“管理复杂写作项目”。
- 规则包可以承担轻量项目记忆，但第一版只展示“本次使用了哪个规则包”，不做复杂编辑。

### 3.6 Writer AI Studio

Writer AI Studio 面向企业 agent 构建，支持 no-code agents、知识图谱、治理、监控和 prompt chaining。

对 doc-marker 的判断：

- 它证明“结构化输入 + 固定输出 + 可治理 Agent”是企业级方向。
- 但它太重，不适合 L1。doc-marker 当前不应做 Agent Builder。
- 我们应该只把后台 pipeline 固定住，L1 只给一个生成入口。

## 4. 对 `/writing` 的产品结论

### 4.1 不做重任务列表

写作用户不需要先理解状态机。左侧最多保留：

| 分组 | 含义 |
|---|---|
| 当前 | 最近正在写的任务 |
| 待处理 | 需要用户选择、反馈或定稿 |
| 历史 | 已完成或暂存任务 |
| 规则包 | 已发布、可复用的规则资产 |

不要在 L1 暴露 `draft / precheck / reviewing / feedback / finalized` 这种系统状态。

### 4.2 不做完整 Chat

完整 Chat 的问题：

- 输入边界会持续变化，难以形成稳定 Job Contract。
- 用户容易陷入来回对话，而不是比较候选。
- 规则沉淀会被埋在聊天上下文里，难以复用和评估。

保留两类局部对话能力：

| 位置 | 交互 | 目的 |
|---|---|---|
| 新建任务 | 一个输入框，LLM 自动补齐隐含契约 | 降低起步成本 |
| 评审候选 | 选中文本后自动分析不满意原因 | 减少人工填写 |

### 4.3 规则后置

L1 不要求用户先维护规则。默认流程：

```text
输入想法/材料
  -> 自动生成本轮临时规则
  -> 生成 3 条独立候选路径
  -> 逐条 eval
  -> 用户选择/轻反馈
  -> 多轮后提示是否沉淀为规则包
```

只有用户选择已发布规则包时，系统才停止自动生成初始规则，改为复用规则包。

### 4.4 第一屏建议

第一屏只放三个区：

1. **输入区**：一个大输入框，支持想法、材料、参考文本混合粘贴。
2. **生成按钮**：主按钮“生成 3 条路径”；下方小字说明“系统会自动提炼临时规则、检查风险，并逐条评估候选”。
3. **结果区**：生成和 eval 完成后展示 3 个候选，不先展示检查表单。

生成前检查只在两种情况显式出现：

- 有高风险 warning，需要用户确认。
- 用户主动展开“生成依据”。

## 5. 产品定位修正

旧定位偏重：

> 文本生产系统 / 写作规则资产工程化平台。

L1 轻量定位应改为：

> 一个开箱即用的文本生成台：先生成多个可比较版本，再用选择和轻反馈推动下一轮收敛。

这句话比“规则资产工程化”更适合 L1 对外解释，也更符合当前第一屏体验。规则资产仍是后续能力，但不抢占 L1 心智。

## 6. 信息源

- Jasper Brand Voice: <https://help.jasper.ai/hc/en-us/articles/18618693085339-Brand-Voice>
- Copy.ai Platform Overview: <https://support.copy.ai/en/articles/10059160-platform-overview>
- Copy.ai Infobase: <https://www.copy.ai/features/infobase>
- Grammarly Brand Tones: <https://support.grammarly.com/hc/en-us/articles/4403544890253-Set-brand-tones>
- ChatGPT Canvas Help: <https://help.openai.com/en/articles/9930697-what-is-the-canvas-featue-in-chatgpt-and-how-do-i-use-it>
- Gemini Canvas: <https://gemini.google/overview/canvas/>
- Claude Artifacts: <https://support.claude.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them>
- Claude Styles: <https://support.claude.com/en/articles/10181068-configure-and-use-styles>
- Claude Custom Skills: <https://support.claude.com/en/articles/12512198-how-to-create-custom-skills>
- Sudowrite Story Bible: <https://docs.sudowrite.com/using-sudowrite/1ow1qkGqof9rtcyGnrWUBS/what-is-story-bible/jmWepHcQdJetNrE991fjJC>
- Sudowrite Canvas: <https://docs.sudowrite.com/using-sudowrite/1ow1qkGqof9rtcyGnrWUBS/canvas/pQGLNzeYo1kLhGo14rdBy6>
- Writer AI Studio: <https://writer.com/product/ai-studio/>
- Writer No-code Agents: <https://dev.writer.com/no-code/introduction>
- Writer Knowledge Graph: <https://support.writer.com/article/244-how-to-use-knowledge-graph>
