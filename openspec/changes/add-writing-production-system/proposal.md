## Why

当前产品定位需要从“源材料生成结构化讲解文档包”抽象上移为“文本生成生产系统”。这不是砍掉原设计，而是把讲解文档包放到 `Output Profile` 层：它仍是首个输出场景，但不再限制产品本质。真实痛点不是缺一个编辑器，而是输入混乱、写作方法来源不稳定、主管审美不稳定、用户自己不是文本专家，导致每次 prompt 都像一次性手工劳动，无法沉淀可复用资产。

## What Changes

- 将产品主流程定义为 `Writing Job`：用户提交目标、素材、参考写法和评审偏好，系统进入标准化生产闭环。
- 新增前置 `Precheck` 环节：把混乱原始输入清洗为固定结构的 `Content Brief`、`Writing Skill Candidate` 和本轮 `Eval Profile`。
- 新增批量生成与评估流程：一次 Job 产出多篇候选文本，按 Eval Profile 自动评分，并支持选中文本轻反馈。
- 新增 Feedback Ledger / Rule Patch / Rule Snapshot 闭环：反馈先进入账本和规则草稿，运行下一批时才生成新候选。
- 新增 Writing Skill 生命周期：从本期候选 skill 开始，经多轮 eval 与人工反馈稳定后，才允许进入发布设计；当前 baseline 不发布。
- 新增 `Output Profile` 语言：结构化讲解文档包是默认输出档案，可继续产出 `plan / scripts / shots / visual_spec / qa_report`。
- 明确边界：用户看到的是“写作资产”和“生产任务”，不是 prompt、agent、内部 schema 或节点实现。
- **抽象上移**：`doc-maker` 不再以“讲解文档包生成工作台”为最高层产品本质；该能力保留为文本生产系统的首个 `Output Profile`。

## Capabilities

### New Capabilities

- `writing-job`: 定义用户创建文本生产任务时输入什么，以及如何把输入归一到统一 Job Spec。
- `precheck-normalization`: 定义 Precheck 如何把混乱输入清洗为 Content Brief、Writing Skill Candidate、Eval Profile 与风险清单。
- `generation-eval-loop`: 定义多篇候选生成、自动 eval、轻反馈、规则草稿和下一轮迭代闭环。
- `writing-skill-lifecycle`: 定义 Writing Skill Candidate 如何迭代、冻结、发布和复用。

### Modified Capabilities

- 无。当前仓库没有已发布 OpenSpec capability。

## Impact

- 受影响文档：`doc-maker/docs/business-console.md`、`doc-maker/docs/07-acceptance.md`、`doc-maker/ui/README.md`，以及后续产品定位 ADR。
- 受影响 UI：`doc-maker/ui/app/page.tsx` 当前 L1 首页、上传/创建入口、mock 数据、Precheck/候选/eval 展示路径。
- 受影响产品语言：Episode、source、artifact package 需要映射到 Writing Job、Content Brief、Writing Skill、Eval Profile、Candidate Draft、Output Profile。
- 不影响当前 L2/L3 诊断框架的底层设计，但需要把诊断入口从“节点控制台”重新解释为写作生产链路的 observability。
