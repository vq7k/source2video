# .eval

项目级 Agent team 行为评测入口。

当前评测方案：

- [`agent-team-behavior-test-plan.md`](./agent-team-behavior-test-plan.md)：验证 Orchestrator / FrameworkWorker / WritingWorker / InfraWorker / QAWorker 的身份、catch-up、边界、委派、状态回写是否符合预期。

## 使用原则

- 先评测 Agent 行为，再让 Worker 写业务/框架代码。
- PASS 必须有证据：对话片段、命令输出、diff、状态文件路径。
- 失败项只记录可复现行为，不写主观印象。
