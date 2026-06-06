# FrameworkWorker Handoff — Task 0 Reconcile

## 任务身份

你是 **FrameworkWorker**，启动 cwd 必须是 `packages/`。

本任务不是 Task 1。先不要实现 generic persistence contracts。

## 背景

冷启动行为 eval 已修复并通过，但复测时发现当前状态不一致：

- `packages/.agent/STATUS.md` 曾写 Task 0 已完成并提交
- git 现场仍有 package topology WIP
- 最近提交不是 `chore(framework): split root package topology`

因此 Orchestrator 重新派发 **Task 0 Reconcile**：先把 Task 0 现场对齐，再决定是否进入 Task 1。

## 目标

核对 `2026-06-05-task-0-package-topology/handoff.md` 中的原 Task 0 是否已完成：

1. framework package 是否已经迁到 root `packages/`
2. legacy `doc-maker/packages/workflow-core|observability` 是否只剩删除状态
3. imports/path alias 是否已指向 `@source2video/*`
4. 测试/typecheck 是否通过
5. 如果通过，只提交 Task 0 归属文件，不 push

## 可写 / 可 stage 路径

只允许处理 Task 0 归属文件：

- `package.json`
- `pnpm-workspace.yaml`
- `packages/workflow-core/**`
- `packages/observability/**`
- `packages/framework-store/**`
- `packages/framework-runtime/**`
- `packages/artifact-store/**`
- `doc-maker/packages/workflow-core/**`
- `doc-maker/packages/observability/**`
- `doc-maker/packages/writing-domain/**`
- `doc-maker/ui/tsconfig.json`
- `doc-maker/ui/vitest.config.ts`
- `doc-maker/ui/tests/runtime/framework-package-topology.test.ts`
- `doc-maker/ui/tests/runtime/trace-status.test.ts`
- `doc-maker/ui/app/api/settings/llm/test/route.ts`
- `doc-maker/ui/app/framework/page.tsx`
- `packages/.agent/STATUS.md`
- `packages/.agent/TODO.md`

## 禁止 stage / 禁止修改

这些是 Orchestrator 或其它范围，不能混入 Task 0 commit：

- `.agent/**`
- `.eval/**`
- `.skill/**`
- `AGENTS.md`
- `CLAUDE.md`
- `doc-maker/AGENTS.md`
- `doc-maker/CLAUDE.md`
- `packages/AGENTS.md`
- `packages/CLAUDE.md`
- `.agents/**`
- 线上部署 / Caddy / 云资源

如发现这些文件影响你验证，回报 Orchestrator，不要自行合并进 commit。

## 必跑验证

从 `packages/` 执行：

```bash
cd ../doc-maker/ui
pnpm exec vitest run tests/runtime/framework-package-topology.test.ts
pnpm test
pnpm typecheck
```

如果 typecheck 因 `.next` 缓存失败：

```bash
rm -rf .next
pnpm typecheck
```

回到仓库根执行：

```bash
git diff --check
rg -n '@doc-maker/(workflow-core|observability)|doc-maker/packages/(workflow-core|observability)' packages doc-maker/packages doc-maker/ui/tests doc-maker/ui/app doc-maker/ui/tsconfig.json doc-maker/ui/vitest.config.ts
```

期望：测试通过；`rg` 无 legacy import/path 命中。文档历史命中不属于本任务。

## 提交要求

验证通过后只 stage 允许路径，提交但不 push：

```bash
git commit -m "chore(framework): split root package topology"
```

如果验证失败，不要提交；把失败命令、错误摘要、建议修复路径回报 Orchestrator。

## 回报格式

```markdown
## FrameworkWorker Summary

- Branch:
- Commit:
- Changed files:
- Commands:
- Result:
- Risks:
- Next actionable:
```
