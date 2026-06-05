# <项目名> — Codex / Aider / 其他 runtime Entry Point

## 启动硬门禁

任何新 session 收到第一条用户输入时（包括“聊聊”“报告状态”这类非任务输入），先读 [`PROJECT.md`](./PROJECT.md)，按 cwd 找角色，再读对应 `.agent/SOUL.md` / `STATUS.md` / `TODO.md`。

未完成 `PROJECT.md` 要求的自报块前，不要闲聊、不要报告 runtime goal、不要开干。
