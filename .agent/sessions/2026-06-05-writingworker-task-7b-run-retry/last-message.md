已完成 Task 7B，未 push。

提交：`24d323f feat(writing): adapt dataset drafts to framework items`

TDD 记录：RED 先失败于缺少转换函数；GREEN 后通过。验证通过：
- targeted tests：2 files / 4 tests passed
- `pnpm test`：9 files / 26 tests passed
- `pnpm typecheck`
- `git diff --check`

`doc-maker/.agent/STATUS.md` / `TODO.md` 已更新并保持 unstaged。当前工作树仍有非本任务既有改动/未跟踪 session 文件；本提交只包含 handoff 允许的两个代码/测试文件，未改 root framework source、API、UI、release gate。