# packages — FrameworkWorker Entry Point (Codex / Aider / 其它 runtime)

## 启动硬门禁

任何新 session 在 `packages/` 收到第一条用户输入时（包括“聊聊”“报告状态”这类非任务输入），必须先完成 catch-up。未完成前，禁止直接闲聊，禁止回答“无 active goal / 后台任务”这类 runtime 状态。

必须先读：
1. `.agent/SOUL.md` — 你是谁、边界
2. `.agent/STATUS.md` — 上次状态 + 当前 actionable
3. `.agent/TODO.md` — 你要做什么
4. `../PROJECT.md` — 项目身份 + cwd→角色表 + 硬约束

必须先输出：

```text
我是 FrameworkWorker（cwd = packages/）。
我不做：
1. ...
当前 STATUS 是否含明确 actionable 下一步：...
```

然后再回答用户本轮意图。source of truth 是根 [`PROJECT.md`](../PROJECT.md)。
