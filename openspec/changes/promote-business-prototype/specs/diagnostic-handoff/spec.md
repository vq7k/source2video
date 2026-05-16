## ADDED Requirements

### Requirement: 业务界面默认隐藏框架内部细节
业务界面默认 MUST 隐藏 Materials、Decision Trace、Eval Attribution、rubrics、node metrics、`pipeline_io` 和跨仓 JSON。

#### Scenario: 用户查看 Business Console
- **WHEN** 用户查看默认 Business Console
- **THEN** 页面内不展示 Materials versions、rubric names、Decision Trace fields、Eval Attribution fields 或 node metrics

#### Scenario: 用户查看业务产出
- **WHEN** 用户从 L1 打开已完成产出
- **THEN** 页面不展示 cross-repo JSON 或 implementation contract details，除非用户显式进入 diagnostics

### Requirement: Diagnostic Handoff 必须显式
系统 MUST 只有在 Episode 需要排查时，才从业务界面提供显式 diagnostic handoff。

#### Scenario: Warning 需要排查
- **WHEN** Episode 状态为 `warn`
- **THEN** Business Console 可以展示一个指向相关 node/artifact 的 diagnostic handoff，并附带业务可读原因

#### Scenario: Failure 需要排查
- **WHEN** Episode 状态为 `failed`
- **THEN** Business Console 可以展示一个指向相关 node/artifact 的 diagnostic handoff，并附带必需下一步动作

#### Scenario: Episode 已完成
- **WHEN** Episode 状态为 `done`
- **THEN** Business Console 默认不展示 node console links

### Requirement: 诊断路由必须声明 readiness
L2/L3 诊断路由 MUST 声明它们是否由真实 artifacts 支撑，或只是 storyboard/mock-only。

#### Scenario: 诊断路由是 mock-only
- **WHEN** 用户打开没有真实 backend artifacts 的诊断路由
- **THEN** 路由展示清晰的 storyboard/mock-only 状态，且不暗示该节点已经实现

#### Scenario: 诊断路由由 artifact 支撑
- **WHEN** 用户使用有效 artifact id 打开诊断路由
- **THEN** 路由解析并展示指定 artifact，而不是 hardcoded latest mock

### Requirement: L2 Hub 只做导航和健康状态
L2 Hub MUST 保持为诊断导航界面，且 MUST NOT 变成跨节点 analytics dashboard。

#### Scenario: 用户打开 L2 Hub
- **WHEN** 用户打开 Hub
- **THEN** 页面展示 node navigation 和粗粒度 health/readiness state

#### Scenario: 请求跨节点指标
- **WHEN** 某设计想在 L2 展示 pass-rate trends、material performance、feedback queues 或其它 cross-node analytics
- **THEN** 该设计必须被拒绝，除非另行提出独立 analytics capability

### Requirement: 诊断动作使用 CLI/Git 契约
诊断反馈和 rerun 动作即使在 mock 中，也 MUST 表现为由 CLI/git 支撑的操作。

#### Scenario: 提交反馈
- **WHEN** diagnostic feedback 被提交
- **THEN** 系统创建或预览结构化 feedback record，包含 artifact id、location、verdict、likely cause、severity、reviewer 和 issue

#### Scenario: 请求 rerun
- **WHEN** 用户请求 diagnostic rerun
- **THEN** 系统展示精确 CLI operation 或 mock-only label，并且不静默修改 product state
