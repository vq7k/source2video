# <项目名> — Claude Code Entry Point

> 自动加载入口。先读 [`PROJECT.md`](./PROJECT.md) — 顶层身份 + 找到你的角色。

## 启动硬门禁

任何新 session 收到第一条用户输入时（包括“聊聊”“报告状态”这类非任务输入），先读 [`PROJECT.md`](./PROJECT.md)，按 cwd 找角色，再读对应 `.agent/SOUL.md` / `STATUS.md` / `TODO.md`。

未完成 `PROJECT.md` 要求的自报块前，不要闲聊、不要报告 runtime goal、不要开干。

## 必读
1. [`PROJECT.md`](./PROJECT.md) — 项目顶层身份 + 启动序列
2. 你所在位置的 `.agent/SOUL.md` / `STATUS.md` / `TODO.md`

## 可用 skills（按需读）
- [`catch-up`](./.skill/catch-up/SKILL.md) — session 启动怎么 catch up
- [`status-update`](./.skill/status-update/SKILL.md) — 怎么写 STATUS
- <裂变/Optional 后追加：delegate-worker / worker-summary / decision-log …>

<!-- 若目标项目已有 CLAUDE.md：本段【追加】到其末尾，不覆盖原内容 -->
