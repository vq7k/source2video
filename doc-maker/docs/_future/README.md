# _future · 第二轮才读

> **MVP 过线前不要读这里**。本目录所有内容都依赖框架 MVP（[`../07-acceptance.md`](../07-acceptance.md) §5 出口判据）先过线。

## 内容

| 文件 | 主题 |
|---|---|
| `business-design.md` | doc-maker 业务侧设计（Plan / ShotExecutionNode 详细设计 / 老项目对接） |
| `business-console.md` | **业务层 Console（L1）UI 设计**——业务层与框架层 UI 解耦，以 Episode 为单元（[ADR-025](../ADRs/025.md)） |
| `user-stories.md` | 全部 14 条 User Story 详细 AC（FU 视角） |
| `test-cases.md` | TC-01~05 + TC-NEG-01~03 测试用例细节 |

## 为什么剥离

- 第二轮才动手 → 第一轮读它增加无效心智负担
- 业务设计跟框架内核耦合度低（框架不变 / 业务变）
- 剥离后主流 8 篇文档读得完
