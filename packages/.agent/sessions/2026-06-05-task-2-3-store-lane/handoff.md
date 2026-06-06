# FrameworkWorker Handoff — Store Lane Task 2 → Task 3

## 任务身份

你是 **FrameworkWorker**，启动 cwd 必须是 `packages/`。

这是连续授权 handoff：完成 Task 2 并提交后，**不要等待 Orchestrator review**，直接继续 Task 3。只有以下情况停止回报：

- 测试/类型检查失败且无法局部修复
- 需要扩大可写范围
- 需要修改 WritingWorker 归属文件
- 需要 push / 部署 / 线上资源
- 发现 framework contracts 需要反向修改 Task 1 commit

## 背景

已完成：

- Task 0：`bda65dd chore(framework): split root package topology`
- Task 1：`5f12449 feat(framework): define generic persistence contracts`

当前目标是把 generic contracts 落到本地 Postgres schema + workflow run repository，但仍保持 business-agnostic。

WritingWorker readiness 已完成。设计 Task 2/3 schema/repository 时参考：

`../../doc-maker/.agent/sessions/2026-06-05-writing-adapter-readiness/summary.md`

重点 needs：

- WorkflowRun repository 保留 `domain` + opaque metadata
- Artifact repository 支持 content/URI + material refs + adapter metadata
- Dataset draft 支持 `needs_human_confirmation`
- Feedback signal 保留 `issue` / `expected` / `confidence` + opaque metadata
- Eval evidence 可按 run/artifact/feedback target 查询 candidate attribution

## 连续执行顺序

### Task 2: Add Postgres Migrations

目标：

- 创建 `packages/framework-store/src/migrations.ts`
- 创建 `packages/framework-store/migrations/0001_framework_core.sql`
- 创建 `doc-maker/ui/scripts/migrate-framework-store.mjs`
- 修改 `doc-maker/ui/package.json` 增加 migration script
- 扩展 `doc-maker/ui/tests/runtime/framework-store.test.ts`，先红后绿验证 schema

必须包含 generic tables：

```text
framework_workflow_runs
framework_node_runs
framework_artifacts
framework_feedback_events
framework_jobs
framework_datasets
framework_dataset_items
framework_experiments
framework_release_gates
framework_schema_migrations
```

禁止任何 `writing_*` table/column/repository 命名。

Task 2 验证：

```bash
cd ../doc-maker/ui
pnpm exec vitest run tests/runtime/framework-store.test.ts
pnpm typecheck
```

回仓库根：

```bash
git diff --check
rg -n 'writing_|doc-maker|docMaker|Writing' packages/framework-store packages/workflow-core
```

Task 2 提交：

```bash
git commit -m "feat(framework): add postgres schema migrations"
```

### Task 3: Implement Workflow Run Repository

Task 2 提交成功后自动继续。

目标：

- 创建 `packages/framework-store/src/db.ts`
- 创建 `packages/framework-store/src/repositories/workflow-runs.ts`
- 修改 `packages/framework-store/src/index.ts`
- 扩展 `doc-maker/ui/tests/runtime/framework-store.test.ts`

Required assertions：

- `putRun` inserts and updates idempotently
- `getRun` returns metadata exactly
- `listRuns({ domain })` filters by domain
- `appendNodeRun` persists node runs independently from business payload

实现要求：

- 不用 ORM
- 使用 parameterized SQL
- JSON 显式序列化/反序列化
- repository API 只使用 generic names

Task 3 验证：

```bash
cd ../doc-maker/ui
pnpm exec vitest run tests/runtime/framework-store.test.ts
pnpm typecheck
```

回仓库根：

```bash
git diff --check
rg -n 'writing_|doc-maker|docMaker|Writing' packages/framework-store packages/workflow-core
```

Task 3 提交：

```bash
git commit -m "feat(framework): persist workflow runs in postgres"
```

## 可写 / 可 stage

- `packages/framework-store/**`
- `packages/workflow-core/**`（仅必要 contract 补丁）
- `doc-maker/ui/scripts/migrate-framework-store.mjs`
- `doc-maker/ui/package.json`
- `doc-maker/ui/tests/runtime/framework-store.test.ts`
- `packages/.agent/STATUS.md`
- `packages/.agent/TODO.md`

## 禁止

- 不改 WritingWorker 正在处理的 readiness 文件
- 不改 `doc-maker/packages/writing-domain/**`
- 不改 UI 页面/API route
- 不改 `.agent/.eval/.skill/AGENTS/CLAUDE/.agents`
- 不 push，不部署，不碰线上资源

## 回报格式

Task 3 完成后一次性回报：

```markdown
## FrameworkWorker Summary

- Branch:
- Commits:
- Task 2 commands/result:
- Task 3 commands/result:
- Changed files:
- Risks:
- Next actionable:
```
