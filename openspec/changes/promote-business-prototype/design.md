## 背景

`doc-maker/ui` 已经包含一套完整的业务侧 UI mock：L1 Business Console、L2 Hub、L3 Toy/Plan/Shot/QA，以及业务产出查看页。这个原型暴露出真实战略变化：项目现在需要直接从业务产品界面中学习，而原文档仍假设当前 MVP 是纯 framework/ToyNode dogfood。

本文档补上缺失的文档先行层。目标不是假装 mock 已经实现完成，而是明确产品工作流、定义原型必须证明什么，并阻止过期的 framework-first 叙事继续驱动错误产品决策。

产品定位：

> doc-maker 是把一组源材料转换成可审阅、可追溯、可迭代的结构化讲解文档包的生成工作台。

首个落地场景是讲解型内容。当前文档包以 `plan / scripts / shots / visual_spec / qa_report` 为核心，但抽象能力是通用的“source → structured explainable document package”。

相关角色：
- 业务操作者：关心上传 → 状态 → 产出 → 清晰决策。
- 框架作者：只在必要时进入诊断 handoff。
- 后续实现者：需要知道哪些路由是产品契约，哪些只是故事板。

当前约束：
- Git/CLI 仍是 source 注册和 rerun 的事实来源。
- 业务界面默认不能让用户理解 Materials、Decision Trace、Eval Attribution、rubric 或跨仓 JSON。
- Plan/Shot/QA backend artifact 尚不存在，因此这些页面在接线前都是诊断故事板。

## 目标 / 非目标

**目标：**
- 将业务侧产品原型提升为当前被文档承认的主工作流。
- 将 Business Console 定义为围绕 Episode，而不是围绕节点。
- 为 done、warn、running、failed Episode 定义可信的状态/动作模型。
- 保留诊断能力，但不把框架内部细节泄漏到默认产品路径。
- 为修正过期文档、UI README 声称和 mock 行为提供任务路径。

**非目标：**
- 在这个 change proposal 里实现真实 backend execution。
- 声称 Plan/Shot/QA 节点已经 production-ready。
- 用数据库上传服务替代 git/CLI。
- 在浏览器里实现 prompt/material 编辑。
- 把 L1 业务 UI 和 L3 诊断 UI 合并成同一个界面。

## 决策

### 决策 1：业务原型成为一等工作流

当前工作线必须被文档化为 `business prototype`，并与早期 `framework ToyNode MVP` 区分开。

理由：UI mock 已经在探索产品级问题：业务用户看到什么、什么叫 done、warn/fail 如何决策、诊断 handoff 从哪里开始。继续把它放在 framework-only MVP 标签下，会同时制造错误失败和错误信心。

考虑过的备选：
- 回退到 ToyNode-only UI：干净，但浪费已经发生的产品发现。
- 把 mock 当作一次性产物：会掩盖最重要的设计学习。

### 决策 2：L1 是产品契约，L2/L3 在接线前是诊断故事板

L1 Business Console 和 L1 产出查看页是产品契约。L2/L3 路由可以保留在原型中，但在真实 artifacts 和 CLI 路径存在前，必须被标注并评估为诊断/故事板界面。

理由：在框架内部稳定前，用户需要先看到一个自洽的顶层产品。诊断页面仍然有设计学习价值，但不能暗示 backend ready。

### 决策 3：Episode 状态必须决定可用动作

产品状态模型必须阻止非法动作：
- `done`：展示产出。
- `warn`：展示人话 warning；只有产出已存在时才允许 accept；只有策略允许时才允许 rerun。
- `running`：展示真实阶段进度；下游阶段不能在上游完成前推进。
- `failed`：展示下一步必需动作；如果 Bounded Budget 或策略要求升级，不提供通用 rerun。

理由：当前 mock 有一个具体 bug：接受 warning 后可能得到 `done` 但没有 outputs。这是产品模型失败，不只是 UI 实现 bug。

### 决策 4：产品界面默认隐藏框架内部细节

业务界面默认不得展示 Materials 版本、Decision Trace、Eval Attribution、rubric 分布、`pipeline_io`、跨仓 JSON 或 node metrics。这些信息有用时，也应该放在显式 diagnostic handoff 后面。

理由：L1 的承诺是“上传并决策”，不是“理解框架”。

### 决策 5：Git-thin 仍是上传和 rerun 契约

上传和 rerun 控件必须被呈现为 CLI/git 的薄壳，包括失败状态。原型可以 mock execution，但产品流必须展示 lint/register/commit/run 失败时会发生什么。

理由：否则产品原型只验证 happy path，真正实现时会被迫重做。

## 风险 / 取舍

- 产品原型可能跑在框架实现前面 → 明确标注故事板路由，并在文档中定义 mock-only 状态。
- 业务 UX 对作者用户可能隐藏太多 → 提供显式 diagnostic handoff，而不是在页面内泄漏细节。
- 文档可能同时存在两套 MVP 叙事 → 将旧叙事重命名为 framework-first plan，或归档为历史上下文。
- Git-thin 失败 UX 可能不如数据库上传 app 顺滑 → 保持诚实；source control 是产品约束。
- L2 Hub 可能变成 dashboard 黑洞 → 限制为导航和健康状态，不做跨节点分析。

## 迁移计划

1. 更新文档，声明当前工作流是业务侧产品原型。
2. 将旧 ToyNode-only MVP 重新归类为 framework MVP / earlier plan。
3. 更新 UI README，使路由声明区分产品契约、诊断故事板和 mock-only 行为。
4. 修正 mock data 和组件中的 L1 状态/动作模型。
5. 移除或 gate 业务界面的框架内部泄漏。
6. 为 git-thin upload 和 rerun 增加失败路径 mock 状态。
7. 在真实 artifacts 存在前，将 Plan/Shot/QA 页面标记为诊断故事板。

回滚策略：在用户确认这条路线是长期方向前，保持该 OpenSpec change 未归档，不写入 baseline specs。

## 未决问题

- 下一轮实现应保持 L2/L3 路由在导航中可见，还是藏到显式 `diagnostics mode` 后面？
- 业务原型只面向“作者本人作为产品用户”，还是也面向非技术用户？
- 产出查看页只展示人类可读文档，还是额外提供面向下游 TTS/Remotion 的 “integration preview”？
