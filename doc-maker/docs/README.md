# doc-maker 文档入口

`doc-maker` 是 source2video 的第一个子项目：当前主线是 **Writing Production 文本生成生产系统**，把混乱素材、参考写法和评审偏好转成可批量生成、可评分、可反馈迭代的短文本产物。

> 讲解文档包没有删除，已下移为默认 Output Profile：`plan / scripts / shots / visual_spec / qa_report`。路线调整见 [ADRs/027.md](./ADRs/027.md) / [ADRs/028.md](./ADRs/028.md)。

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
| 产品 | [business-console.md](./business-console.md) | 当前 L1 业务产品原型 SOT |
| 06 | [ui-spec.md](./06-ui-spec.md) | L2/L3 诊断层 console UI 规格 |
| 07 | [acceptance.md](./07-acceptance.md) | 业务原型验收 + framework ToyNode 历史基线 |
| 08 | [tech-stack.md](./08-tech-stack.md) | 技术选型 + pyproject + .env |
| 框架 | [framework-core.md](./framework-core.md) | 可迁移框架层实现设计：workflow-core / Langfuse / eval / adapter |

## 参考（按需查）

- [ADRs/](./ADRs/) — ADR-001~029（业务侧 + 框架内核决策）+ 仓级 ADR-023/024 stub
- [reference/cli.md](./reference/cli.md) — CLI 速查
- [reference/schemas.md](./reference/schemas.md) — 数据契约集中（Pydantic schema）
- [reference/langfuse.md](./reference/langfuse.md) — Langfuse env、Trace/Scores/Human Feedback/Dataset 映射与验证

## Future（当前不作为主线）

- [_future/](./_future/) — business-design / user-stories / test-cases；其中 `business-console.md` 已提升到当前主线。
