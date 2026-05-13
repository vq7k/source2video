# nodes/qa

**业务侧第二轮才开发的节点**（Episode 级 QA 节点）。当前为 [ADR-019](../../docs/ADRs/019.md) "节点级目录就近放" 的占位目录。

## 状态

- 框架 MVP 出口判据（[07-acceptance.md](../../docs/07-acceptance.md) §5）**不要求**此节点
- 整集级"主编"角色——跨 shot 一致性 + Plan 兑现度 + 下游 gating + 反馈聚类入口（详见原型 UI 中 `/about` 模型 5）
- 设计详情见 [_future/business-design.md](../../docs/_future/business-design.md)（期级 QA 段落）

## 子目录约定（ADR-019）

| 目录 | 内容 | 状态 |
|---|---|---|
| `prompts/` | 物料 · LLM 调用模板（跨 shot 一致性检查 prompt） | 空 |
| `rubrics/` | 物料 · QA 维度（cross_shot_consistency / duration_alignment / terminology_consistency / callback_coverage / arc_completeness / style_drift / transition_cohesion / executability 复查） | 空 |
| `schemas/` | 物料 · Pydantic 模型（QaArtifact / QaDimension / QaVerdict） | 空 |
| `ui/` | L3 节点控制台（原型阶段集中在 `doc-maker/ui/app/node/qa/`） | 空 |
| `eval/` | 节点 regression set + auto-judge config | 空 |
| `fixtures/` | 节点专属 fixture | 空 |
| `docs/` | 节点级技术文档 | 空 |
