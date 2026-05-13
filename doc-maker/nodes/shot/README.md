# nodes/shot

**业务侧第二轮才开发的节点**（ShotExecutionNode）。当前为 [ADR-019](../../docs/ADRs/019.md) "节点级目录就近放" 的占位目录。

## 状态

- 框架 MVP 出口判据（[07-acceptance.md](../../docs/07-acceptance.md) §5）**不要求**此节点
- per-shot 调用（每个 shot 一次独立调用，每个 shot 一份独立 artifact）—— 跟 toy / plan / qa 一个 Episode 调一次根本不同
- 设计详情见 [_future/business-design.md](../../docs/_future/business-design.md) §4 ShotExecutionNode 详细设计（三件套 text / text_tts / notes + 内部 3 步链 + Evaluator-Optimizer）

## 子目录约定（ADR-019）

| 目录 | 内容 | 状态 |
|---|---|---|
| `prompts/` | 物料 · LLM 调用模板（text / text_tts / notes 三件套各一份） | 空 |
| `rubrics/` | 物料 · Eval 维度（含 cross_step_consistency） | 空 |
| `schemas/` | 物料 · Pydantic 模型（ShotArtifact） | 空 |
| `ui/` | L3 节点控制台（原型阶段集中在 `doc-maker/ui/app/node/shot/`） | 空 |
| `eval/` | 节点 regression set + auto-judge config | 空 |
| `fixtures/` | 节点专属 fixture | 空 |
| `docs/` | 节点级技术文档 | 空 |
