# _future · 非当前主线

> 当前主线已按 [ADR-027](../ADRs/027.md) 切到业务产品原型。`business-console.md` 已提升到 [`../business-console.md`](../business-console.md)，本目录只保留暂不实施的业务案例细节。

## 内容

| 文件 | 主题 |
|---|---|
| `business-design.md` | doc-maker 业务侧设计（Plan / ShotExecutionNode 详细设计 / 老项目对接） |
| `user-stories.md` | 全部 14 条 User Story 详细 AC（FU 视角） |
| `test-cases.md` | TC-01~05 + TC-NEG-01~03 测试用例细节 |

## 为什么剥离

- 暂不作为当前实现主线 → 直接读会混淆业务原型与框架历史基线
- 业务设计跟框架内核耦合度低（框架不变 / 业务变）
- 剥离后主流 8 篇文档读得完
