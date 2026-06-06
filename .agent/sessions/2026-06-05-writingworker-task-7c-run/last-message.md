已完成 Task 7C，并已提交，未 push。

Commit：`2368e0e feat(writing): persist dataset drafts through api flow`

实现内容：
- 新增 `persistWritingDatasetDraftsForRun()`
- 新增 `/api/writing-runs/[runId]/dataset-drafts` POST route
- route 支持 repository provider 注入；未配置时明确返回 `503 repository_unconfigured`
- 新增 TDD 测试覆盖 service、API 成功路径、repository 未配置路径

验证已通过：
- `pnpm exec vitest run tests/runtime/writing-dataset-persistence.test.ts tests/runtime/writing-adapter-readiness.test.ts tests/runtime/framework-dataset.test.ts`
- `pnpm test`
- `pnpm typecheck`
- `git diff --check`
- `git diff --cached --check`
- `git show --name-only --pretty=format: HEAD -- packages` 无输出

状态文件 `.agent/STATUS.md` / `.agent/TODO.md` 已更新但保持 unstaged。