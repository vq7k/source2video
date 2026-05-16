## ADDED Requirements

### Requirement: 业务原型 Scope 必须显式化
系统 MUST 将业务侧产品原型记录为当前工作流，并与 framework ToyNode MVP 区分开。

#### Scenario: 当前工作流被呈现
- **WHEN** 贡献者阅读 UI prototype 文档
- **THEN** 文档会标明每个路由属于产品契约、诊断故事板还是 mock-only 行为

#### Scenario: 引用 framework MVP
- **WHEN** repo 中仍保留 framework ToyNode MVP 文档
- **THEN** 这些文档会被标注为 framework-first scope，且不能覆盖业务产品原型 scope

### Requirement: Episode 列表是主要业务界面
Business Console MUST 以 Episode 呈现工作，包含状态、source、进度和产出决策，而不是节点级框架活动。

#### Scenario: Done Episode
- **WHEN** Episode 状态为 `done`
- **THEN** Business Console 展示可用的人类可读产出，且不展示 node console 链接

#### Scenario: Running Episode
- **WHEN** Episode 状态为 `running`
- **THEN** Business Console 展示真实有序的进度状态，下游阶段不得在上游完成前推进

#### Scenario: Failed Episode
- **WHEN** Episode 状态为 `failed`
- **THEN** Business Console 展示人话失败原因，并展示符合失败策略的下一步动作

### Requirement: Done 必须有 Outputs
系统 MUST NOT 允许缺少预期 output links 的 Episode 显示为 `done`。

#### Scenario: 用户接受 warning
- **WHEN** 用户接受某个 Episode 的 warning
- **THEN** 只有 scripts、shots 和 QA report outputs 都可用时，该 Episode 才能变为 `done`

#### Scenario: Outputs 缺失
- **WHEN** warning outputs 不可用
- **THEN** 用户不能将该 Episode 接受为 complete，而是被引导到 rerun 或 diagnostics

### Requirement: 业务动作必须有限且有效
Business Console MUST 只暴露当前 Episode 状态下业务有效的动作。

#### Scenario: 通用控件
- **WHEN** 用户查看 Business Console
- **THEN** 没有明确产品动作的控件会被隐藏，或以显式 mock/storyboard 标签禁用

#### Scenario: Bounded Budget 失败
- **WHEN** Episode 因触发 Bounded Budget cap 而失败
- **THEN** Business Console 不提供通用一键 rerun，而是展示 escalation/diagnostic handoff

### Requirement: Upload 使用 Git-thin 产品流程
上传流程 MUST 将 source upload 表现为 CLI/git registration 的薄壳，并覆盖成功与失败状态。

#### Scenario: 上传成功
- **WHEN** lint、register、commit 和 run trigger 全部成功
- **THEN** Episode 以 running 状态出现在列表中，并带有已提交的 source reference

#### Scenario: Lint 失败
- **WHEN** source lint 失败
- **THEN** UI 用业务可读语言展示 CLI failure，且不创建 running Episode

#### Scenario: Commit 失败
- **WHEN** git commit 失败
- **THEN** UI 展示 source registration 未完成，且不暗示 run 已经启动

### Requirement: Output Viewer 必须业务可读
产出查看页 MUST 优先展示人类可读产出，并默认隐藏实现 artifact。

#### Scenario: 用户打开 scripts output
- **WHEN** 用户打开 scripts output
- **THEN** viewer 展示标题、时长、章节和 script 内容，不要求用户理解 Materials、traces 或跨仓 contracts

#### Scenario: 用户打开 QA report
- **WHEN** 用户打开 QA report
- **THEN** viewer 用业务语言展示可行动的质量状态和 warnings
