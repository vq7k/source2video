已完成 Task 7A，未 push。

提交：`55cd28e feat(framework): persist dataset drafts`

TDD 记录：RED 因缺少 `repositories/datasets` 失败；GREEN 后通过：

- `framework-dataset.test.ts` + `framework-store.test.ts`: 9 passed
- `pnpm test`: 25 passed
- `pnpm typecheck`
- `git diff --check`
- business-name scan clean

`packages/.agent/STATUS.md` / `TODO.md` 已更新但保持未提交；当前 staged 为空。