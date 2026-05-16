# doc-maker 产品调研：文档生成功能 + 可观测 Eval 闭环

> 时间：2026-05-15
> 范围：只调研 doc-maker 的文档生成功能。即 source/PPT/Markdown → plan/script/shot docs/visual spec/QA report。
> 不调研：TTS、Remotion、成品视频编辑器、素材资产市场、音频/视频发布平台。

## 0. 一句话结论

类似产品大多解决“输入资料 → 摘要/讲稿/演示文档/视觉表达”的前半段，但很少把“生成质量为什么好/坏、如何持续改进”做成可观测闭环。doc-maker 的机会不是再做一个 deck generator，而是做一个**可追溯、可评估、可迭代的文档生成工作台**。

产品一句话：

> doc-maker 是把一组源材料转换成可审阅、可追溯、可迭代的结构化讲解文档包的生成工作台。

这意味着它现在不锁死在某个具体业务域；“讲解型内容”只是首个落地场景，`plan / scripts / shots / visual_spec / qa_report` 是首版文档包形态。

## 1. 业务调研层

### 1.1 参考产品地图

| 产品 | 文档生成相关能力 | 可借鉴点 | 不照搬点 |
|---|---|---|---|
| NotebookLM | 基于用户上传 sources 生成摘要、问答、Audio/Video Overview；强调基于 source、可引用原文 | source-grounded、引用、把复杂资料转成可消费讲解 | 默认偏“学习/理解”，不输出可接下游生产的结构化文档包 |
| Gamma | 导入 PPT/Docs/Word/PDF/URL，生成重新排版的 presentation/doc | 导入后快速生成可编辑文档；产品体验重在“立刻成稿” | 偏设计成品，不解释生成依据和质量风险 |
| Microsoft Copilot PowerPoint | 从 Word/PDF 等文件生成 PowerPoint 草稿，支持企业模板 | 从结构化源文档推导演示结构；与办公格式深度集成 | 目标是 PPT 成品，不是生成过程可诊断 |
| Beautiful.ai | 先生成 slide-by-slide outline，再进入设计 | outline-first 能保留用户意图，减少“一步到成品”的失控 | 主要优化 presentation，不覆盖脚本/QA/visual spec 文档包 |
| Napkin AI | 从文本生成可编辑视觉图、图解、流程图，可导出 PPT/PNG/SVG/PDF | “文字段落 → 视觉候选”适合 visual_spec/notes 阶段 | 它是视觉表达工具，不负责叙事脚本和质量闭环 |
| Google Vids | 从 prompt/file 生成可编辑 video outline、scenes、素材建议 | “outline + scenes”与 doc-maker 的 shot docs 很接近 | 输出目标是视频制作 app，doc-maker 当前只生成文档 |

来源：
- NotebookLM Audio Overview 官方帮助：<https://support.google.com/notebooklm/answer/16212820>
- Google NotebookLM source 支持与引用说明：<https://blog.google/innovation-and-ai/products/notebooklm-audio-video-sources/>
- Gamma import docs/slides：<https://help.gamma.app/en/articles/11047840-how-can-i-import-slides-or-documents-into-gamma>
- Microsoft Copilot PowerPoint FAQ：<https://support.microsoft.com/en-us/office/frequently-asked-questions-about-copilot-in-powerpoint-3e229188-9086-4f4c-9f9f-824cd25ae84f>
- Beautiful.ai AI presentation flow：<https://support.beautiful.ai/hc/en-us/articles/12885226948109-Creating-a-presentation-with-AI>
- Napkin AI：<https://www.napkin.ai/>
- Google Vids Help：<https://support.google.com/docs/answer/15082958>

### 1.2 对 doc-maker 的业务启发

| 业务问题 | 外部产品常见解法 | doc-maker 应用 |
|---|---|---|
| 用户不知道源材料能产出什么 | 先给 outline / overview / card draft | 上传后先生成 Episode plan preview，而不是直接进入节点细节 |
| 生成内容是否忠实 source | NotebookLM 强调 source 引用 | 每个关键脚本文档段落保留 source citation，但默认用业务语言显示 |
| 文档是否可接下游 | 大多产品只给最终 deck/doc | doc-maker 必须输出文档包：`scripts.md`、`shots/`、`visual_spec`、`qa_report` |
| 用户如何修正不满意结果 | 产品通常提供编辑器或重新生成 | L1 只给 accept/rerun/escalate；具体物料反馈放 L3 诊断 |
| 视觉表达如何设计 | Napkin 从文本生成视觉候选 | `visual_spec/notes` 应从“画面候选 + 约束”开始，而不是直接做 Remotion |
| 产品信任如何建立 | 成品预览 + 引用 + 可编辑 | 输出页显示“可读文档 + source coverage + warning”，不展示 framework internals |

### 1.3 推荐的业务功能边界

当前业务原型应聚焦 4 个 job：

1. **上传素材**：PPT/Markdown/讲义进入 Episode。
2. **生成文档包**：plan、script、shot docs、visual spec、QA report。
3. **业务验收**：用户判断能否接受这包文档，而不是评估模型/物料。
4. **问题 handoff**：warn/fail 时跳诊断，不在 L1 解释 Materials/Trace/Rubric。

不该进入当前业务层：

- Prompt/material 编辑。
- 节点级 metrics 分析。
- 跨节点 pass-rate dashboard。
- TTS/Remotion 成品视频状态。
- 复杂协作/权限。

## 2. 可观测 Eval 闭环层

### 2.1 参考产品地图

| 产品 | Eval/Observability 相关能力 | 可借鉴点 | doc-maker 对应 |
|---|---|---|---|
| Langfuse | traces、prompt management、evals、datasets、experiments、human annotation | 把 trace/eval/prompt/version 放在一个工作流 | Decision Trace + Materials version + Eval Attribution + reports |
| Braintrust | datasets、scorers、experiments、playground 对比 | dataset + scorer + experiment snapshot 是闭环核心 | fixtures/regression + judge scorers + run diff |
| Humanloop | online/offline evaluators、production monitoring、logs → dataset | 线上 logs 自动 eval，再把问题样本沉淀为 dataset | 生产 Episode warning/fail → feedback queue → regression set |

来源：
- Langfuse overview：<https://langfuse.com/docs>
- Langfuse product/evals/prompt workflow：<https://langfuse.com/>
- Braintrust evaluation overview：<https://www.braintrust.dev/docs/evaluate>
- Braintrust playground：<https://www.braintrust.dev/docs/platform/playground>
- Humanloop evaluators：<https://humanloop.com/docs/v4/evaluators>
- Humanloop monitoring：<https://humanloop.com/docs/guides/observability/monitoring>

### 2.2 外部 eval 工具共同模式

```
输入样本 / 生产日志
        │
        ▼
生成任务（prompt / workflow / agent）
        │
        ▼
Trace + Output + Metadata
        │
        ├── 自动 scorer / LLM judge
        ├── 人工 annotation
        └── 线上 monitoring
        │
        ▼
Dataset / Regression set
        │
        ▼
Experiment compare
        │
        ▼
Prompt/material/version promotion
```

共同点：

- eval 单元不是“页面”，而是一次 run / trace / artifact。
- scorer 必须绑定 dataset，否则只能做主观打分。
- prompt/material 需要版本化，否则无法解释回归。
- production warning/fail 应回流到 dataset，而不是只在 UI 上消失。
- playground 适合探索，experiment 才适合做晋升依据。

### 2.3 doc-maker 的闭环设计

doc-maker 应有两套可观测层：

| 层 | 面向谁 | 展示什么 | 不展示什么 |
|---|---|---|---|
| L1 业务可观测 | 业务操作者 | Episode 状态、文档包完整性、source coverage、业务 warning、可接受/需重跑/需诊断 | Materials、Decision Trace、rubric、judge thinking |
| L3 诊断可观测 | 作者/维护者 | artifact 字段、Materials version、Decision Trace、Eval Attribution、feedback、rerun diff | 业务产品包装和无关跨 Episode dashboard |

建议闭环：

```
Episode source
  │
  ▼
文档生成 run
  │
  ├─ outputs: scripts / shots / visual_spec / qa_report
  ├─ trace: prompt render / materials / model / token / latency
  └─ eval: source coverage / faithfulness / structure / visual feasibility / duration alignment
  │
  ▼
L1: accept / rerun / diagnostic handoff
  │
  ▼
L3: structured feedback
  │
  ▼
feedback 聚类（同因 ≥ N）
  │
  ▼
material/schema/rubric 改动
  │
  ▼
regression diff + holdout gate
  │
  ▼
version bump / rollback
```

### 2.4 doc-maker 的 eval 维度建议

| 维度 | 问题 | L1 展示 | L3 诊断 |
|---|---|---|---|
| source_coverage | 是否覆盖源材料关键点 | “覆盖充分/有遗漏” | citation + missing source spans |
| faithfulness | 是否忠实 source，没有编造 | “发现疑似未依据源材料的内容” | violated span + source evidence |
| narrative_structure | 讲解结构是否顺 | “结构可读/需重排” | plan step eval + shot dependency |
| doc_package_completeness | 文档包是否齐全 | “scripts/shots/qa 是否可用” | schema validation |
| visual_feasibility | visual spec 是否可制作 | “画面指引是否明确” | notes field eval + unsupported visual patterns |
| duration_alignment | 时长是否接近目标 | “偏长/偏短” | per-shot delta + QA attribution |
| audience_fit | 是否适合目标受众 | “过难/过浅/合适” | rubric anchor + examples |

### 2.5 关键产品判断

1. **业务层只显示 eval 结果，不显示 eval 机制。**
   L1 看到的是“这包文档能不能用、哪里要处理”，不是 judge prompt。

2. **诊断层必须能追溯。**
   L3 需要从一个失败字段追到 source、prompt、materials、judge attribution、feedback history。

3. **反馈不是立即改 prompt。**
   单条反馈只是样本；聚类后才触发 material/schema/rubric 改动。

4. **业务原型先验证文档包价值。**
   在证明 scripts/shots/visual_spec/qa_report 对真实工作有价值前，不要急着扩成视频成品平台。

## 3. 对当前 OpenSpec change 的影响

应在 `promote-business-prototype` 后续实现里补三类任务：

- 文档：把“类似产品调研”纳入业务原型设计依据。
- UI：L1 输出页增加业务可读的 `source coverage / warning / completeness`，但不泄漏内部 trace。
- 诊断：L3 保留完整 trace/eval/feedback，用于闭环，不把它做成 L1 dashboard。
