# FrameworkWorker Handoff — Task 1 Generic Persistence Contracts

## 任务身份

你是 **FrameworkWorker**，启动 cwd 必须是 `packages/`。

本任务只做 **contracts freeze**，不要进入 Task 2 migrations、Task 3 repository implementation、Task 5 runtime worker。

## 背景

Task 0 已提交：

- commit：`bda65dd chore(framework): split root package topology`
- root `packages/` 已成为 generic framework 所有权位置
- `doc-maker/packages/` 只保留 Writing adapter

现在进入 `docs/superpowers/plans/2026-06-05-framework-data-plane-plan.md` 的 **Phase 0 / Task 1: Define Generic Persistence Contracts**。

## 目标

冻结 business-agnostic persistence contracts：

- `packages/workflow-core/src/artifact.ts`
- `packages/workflow-core/src/feedback.ts`
- `packages/workflow-core/src/eval.ts`
- `packages/framework-store/src/index.ts`
- `doc-maker/ui/tests/runtime/framework-store.test.ts`

需要导出 generic `FrameworkStore` 类型：

```ts
export type FrameworkStore = {
  workflowRuns: WorkflowRunRepository;
  artifacts: ArtifactRepository;
  jobs: JobRepository;
  datasets: DatasetRepository;
};
```

Repository method names 使用 generic 语义，例如：

```text
putRun, getRun, listRuns, appendNodeRun,
putArtifact,
enqueueJob, leaseJob, completeJob, failJob
```

## 边界

可写：

- `packages/workflow-core/src/artifact.ts`
- `packages/workflow-core/src/feedback.ts`
- `packages/workflow-core/src/eval.ts`
- `packages/framework-store/src/index.ts`
- `packages/framework-store/src/**/*.ts`（仅 type/interface，不做 SQL implementation）
- `doc-maker/ui/tests/runtime/framework-store.test.ts`
- `packages/.agent/STATUS.md`
- `packages/.agent/TODO.md`

禁止：

- 不创建 SQL migration
- 不接 Postgres client
- 不实现 queue worker
- 不改 Writing UI/API/runtime
- 不改 `doc-maker/packages/writing-domain/**`
- 不 stage `.agent/.eval/.skill/AGENTS/CLAUDE` 这类 Orchestrator-owned 文件
- 不出现 `writing_*` 表名、字段名、repository 名

## TDD 要求

先写 failing test：

```bash
cd ../doc-maker/ui
pnpm exec vitest run tests/runtime/framework-store.test.ts
```

Expected red：`framework-store` contracts 缺失或 domain-specific 命名断言失败。

再实现最小 contracts，使测试通过。

## 必跑验证

```bash
cd ../doc-maker/ui
pnpm exec vitest run tests/runtime/framework-store.test.ts
pnpm test
pnpm typecheck
```

回仓库根：

```bash
git diff --check
rg -n 'writing_|doc-maker|docMaker|Writing' packages/framework-store packages/workflow-core
```

期望：测试/typecheck 通过；`rg` 无 framework package 业务命名命中。

## 提交要求

只 stage 本任务允许路径，提交但不 push：

```bash
git commit -m "feat(framework): define generic persistence contracts"
```

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
