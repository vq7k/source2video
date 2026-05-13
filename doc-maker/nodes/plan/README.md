# nodes/plan

**业务侧第二轮才开发的节点**。当前为 [ADR-019](../../docs/ADRs/019.md) "节点级目录就近放" 的占位目录。

## 状态

- 框架 MVP 出口判据（[07-acceptance.md](../../docs/07-acceptance.md) §5）**不要求**此节点
- 业务侧第二轮启动条件 = 框架 MVP 通过（[_future/business-design.md](../../docs/_future/business-design.md) §9）
- 设计详情见 [_future/business-design.md](../../docs/_future/business-design.md) §3 Plan 节点详细设计

## 子目录约定（ADR-019）

| 目录 | 内容 | 状态 |
|---|---|---|
| `prompts/` | 物料 · LLM 调用模板 | 空（待第二轮 bootstrap） |
| `rubrics/` | 物料 · Eval 维度 + anchor | 空 |
| `schemas/` | 物料 · Pydantic 模型 | 空 |
| `ui/` | L3 节点控制台（**注意**：原型阶段集中在 `doc-maker/ui/app/node/plan/`，未来按 [ADR-019](../../docs/ADRs/019.md) 拆来这里，见 [ADR-026](../../docs/ADRs/026.md)） | 空 |
| `eval/` | 节点 regression set + auto-judge config | 空 |
| `fixtures/` | 节点专属 fixture（如果有） | 空 |
| `docs/` | 节点级技术文档 | 空 |

## 加 prompt / rubric 时

按 [05-recipes.md](../../docs/05-recipes.md) §5.2 加新物料 + §5.3 加新节点 step-by-step。
