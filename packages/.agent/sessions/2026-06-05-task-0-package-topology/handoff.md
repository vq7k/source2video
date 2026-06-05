# FrameworkWorker Handoff — Task 0 Package Topology Split

## 任务身份

我是 Orchestrator 派给 FrameworkWorker 的 handoff。FrameworkWorker 启动 cwd：`packages/`。

接手前必须 catch-up：

1. 读 `../PROJECT.md`
2. 读 `.agent/SOUL.md`
3. 读 `.agent/STATUS.md`
4. 读 `.agent/TODO.md`
5. 自报 `我是 FrameworkWorker（cwd = packages/）。`

## 背景

当前分支：`codex/framework-topology`。

当前有未提交 WIP。这个 WIP 是 Orchestrator 越界启动的，现正式移交 FrameworkWorker 接手。不要因为它不是你亲手创建就回滚；先验证方向，再继续或回报。

已知 WIP：

- 新增 failing test：`doc-maker/ui/tests/runtime/framework-package-topology.test.ts`
- 已把 `doc-maker/packages/workflow-core` 移到 `packages/workflow-core`
- 已把 `doc-maker/packages/observability` 移到 `packages/observability`
- 已新增 skeleton：`packages/framework-store`、`packages/framework-runtime`、`packages/artifact-store`
- 已开始把 imports 从 `@doc-maker/workflow-core|observability` 改到 `@source2video/workflow-core|observability`
- 已新增 root `package.json` / `pnpm-workspace.yaml`

## 目标

完成 `docs/superpowers/plans/2026-06-05-framework-data-plane-plan.md` 的 **Task 0: Move Framework Ownership to Root Packages**。

验收条件：

- generic framework packages 只在 root `packages/`：
  - `packages/workflow-core`
  - `packages/observability`
  - `packages/framework-store`
  - `packages/framework-runtime`
  - `packages/artifact-store`
- `doc-maker/packages/` 只保留 Writing 业务 adapter，例如 `writing-domain`
- `doc-maker/ui/tsconfig.json` 和 `doc-maker/ui/vitest.config.ts` 指向 root `../../packages/*`
- 源码不再 import legacy `@doc-maker/workflow-core` 或 `@doc-maker/observability`
- Writing 现有 runtime tests/typecheck 仍通过

## 边界

可写：

- `packages/**`
- `doc-maker/packages/writing-domain/**` 的 import/path 适配
- `doc-maker/ui/tsconfig.json`
- `doc-maker/ui/vitest.config.ts`
- `doc-maker/ui/tests/runtime/framework-package-topology.test.ts`
- root `package.json`
- root `pnpm-workspace.yaml`

不要写：

- `doc-maker/ui/app/**`，除非只是 import alias 替换
- `doc-maker/docs/**`
- 根 `.agent/**`，除非只是回报 Orchestrator 后由 Orchestrator 改
- 线上部署 / Caddy / 云资源
- `docs.legacy/**`

如需扩大范围，先回报 Orchestrator。

## TDD 状态

RED 已创建但需要你重新验证：

```bash
cd ../doc-maker/ui
pnpm exec vitest run tests/runtime/framework-package-topology.test.ts
```

当前期望：如果 WIP 未完成，测试会失败；完成后必须 PASS。

## 必跑验证

在提交前运行：

```bash
cd ../doc-maker/ui
pnpm exec vitest run tests/runtime/framework-package-topology.test.ts
pnpm test
pnpm typecheck
```

如果 `pnpm typecheck` 暴露 Next generated type 或缓存问题，先清理 `.next` 后重跑：

```bash
rm -rf .next
pnpm typecheck
```

回到仓库根后运行：

```bash
git diff --check
rg -n '@doc-maker/(workflow-core|observability)|doc-maker/packages/(workflow-core|observability)' packages doc-maker/packages doc-maker/ui/tests doc-maker/ui/app doc-maker/ui/tsconfig.json doc-maker/ui/vitest.config.ts
```

期望：`rg` 无 legacy import/path 命中。文档里的历史说明不用本任务修改。

## 提交要求

验证通过后提交，不 push：

```bash
git add package.json pnpm-workspace.yaml packages doc-maker/packages doc-maker/ui/tsconfig.json doc-maker/ui/vitest.config.ts doc-maker/ui/tests/runtime/framework-package-topology.test.ts
git commit -m "chore(framework): split root package topology"
```

## 回报格式

完成后回报 Orchestrator：

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
