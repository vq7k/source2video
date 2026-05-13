# doc-maker 文档入口

`doc-maker` 是 source2video 的第一个子项目——LLM workflow 流水线（PPT/教材 markdown → script + visual_spec + qa 文档）。

> 仓级文档（跨子项目）见 [`../../docs/`](../../docs/)。

---

## 主流（按编号顺序读）

| # | 文件 | 角色 |
|---|---|---|
| 00 | [glossary.md](./00-glossary.md) | 术语单一定义 |
| 01 | [quickstart.md](./01-quickstart.md) | 5 步跑通 toy 节点 |
| 02 | [architecture.md](./02-architecture.md) | 框架本体（5 抽象 + 6 模块） |
| 03 | [invariants.md](./03-invariants.md) | 16 主 + 3 子不变量 |
| 04 | [handbook.md](./04-handbook.md) | 日常 4 动作循环 |
| 05 | [recipes.md](./05-recipes.md) | 加新 source / 物料 / 节点 / console 的 step-by-step |
| 06 | [ui-spec.md](./06-ui-spec.md) | Per-Node Console UI 规格 |
| 07 | [acceptance.md](./07-acceptance.md) | MVP 验收（出口判据 9 条） |
| 08 | [tech-stack.md](./08-tech-stack.md) | 技术选型 + pyproject + .env |

## 参考（按需查）

- [ADRs/](./ADRs/) — 22 条 dm 决策 + 仓级 ADR-023/024 stub
- [reference/cli.md](./reference/cli.md) — CLI 速查
- [reference/schemas.md](./reference/schemas.md) — 数据契约集中（Pydantic schema）

## 第二轮（MVP 过线前不读）

- [_future/](./_future/) — business-design / user-stories / test-cases
