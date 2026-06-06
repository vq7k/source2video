# FrameworkWorker Handoff — Artifact/Runtime Lane Task 4 → Task 5

## 任务身份

你是 **FrameworkWorker**，启动 cwd 必须是 `packages/`。

这是连续授权 handoff：完成 Task 4 并提交后，**不要等待 Orchestrator review**，直接继续 Task 5。只有以下情况停止回报：

- 测试/类型检查失败且无法局部修复
- 需要扩大可写范围
- 需要修改 WritingWorker 归属文件
- 需要 push / 部署 / 线上资源
- 发现 Task 1/2/3 contracts 需要反向修改

## 背景

已完成并验收：

- Task 0：`bda65dd chore(framework): split root package topology`
- Task 1：`5f12449 feat(framework): define generic persistence contracts`
- Task 2：`379c20b feat(framework): add postgres schema migrations`
- Task 3：`307020b feat(framework): persist workflow runs in postgres`

Writing Adapter Readiness needs 已写入：

`../../doc-maker/.agent/sessions/2026-06-05-writing-adapter-readiness/summary.md`

## 连续执行顺序

### Task 4: Add Artifact Store Abstraction

目标：

- `packages/artifact-store/src/index.ts`
- `packages/artifact-store/src/minio.ts`
- `packages/framework-store/src/repositories/artifacts.ts`
- `packages/workflow-core/src/artifact.ts`
- `doc-maker/ui/tests/runtime/framework-store.test.ts`

Required behavior：

- 小 payload 可 inline 保存在 Postgres artifact metadata
- 大 payload 写入 artifact store，Postgres 只保存 `uri` / `contentHash` / `byteLength`
- 先实现 filesystem local adapter；MinIO/OSS 只做 S3-compatible adapter 边界，凭证只走 env

Task 4 验证：

```bash
cd ../doc-maker/ui
pnpm exec vitest run tests/runtime/framework-store.test.ts
pnpm typecheck
```

回仓库根：

```bash
git diff --check
rg -n 'writing_|doc-maker|docMaker|Writing' packages/framework-store packages/workflow-core packages/artifact-store
```

Task 4 提交：

```bash
git commit -m "feat(framework): add artifact store abstraction"
```

### Task 5: Implement Postgres Job Queue

Task 4 提交成功后自动继续。

目标：

- `packages/framework-runtime/src/jobs.ts`
- `packages/framework-runtime/src/worker.ts`
- `packages/framework-runtime/src/handlers.ts`
- `packages/framework-store/src/repositories/jobs.ts`
- `doc-maker/ui/scripts/run-framework-worker.mjs`
- `doc-maker/ui/package.json`
- `doc-maker/ui/tests/runtime/framework-worker.test.ts`

Required behavior：

- queued job can be leased by one worker only
- failed job retries until `max_attempts`
- expired lock can be leased again
- completed job is never leased again
- worker exposes bounded `once()` for tests

Implementation requirements：

- repository uses parameterized SQL
- lease semantics should be compatible with `for update skip locked`
- handler registry is generic; business job types belong in adapters later

Task 5 验证：

```bash
cd ../doc-maker/ui
pnpm exec vitest run tests/runtime/framework-worker.test.ts tests/runtime/framework-store.test.ts
pnpm test
pnpm typecheck
```

回仓库根：

```bash
git diff --check
rg -n 'writing_|doc-maker|docMaker|Writing' packages/framework-store packages/workflow-core packages/artifact-store packages/framework-runtime
```

Task 5 提交：

```bash
git commit -m "feat(framework): add postgres-backed worker runtime"
```

## 可写 / 可 stage

- `packages/artifact-store/**`
- `packages/framework-store/**`
- `packages/framework-runtime/**`
- `packages/workflow-core/**`（仅 artifact/job contract 必要补丁）
- `doc-maker/ui/scripts/migrate-framework-store.mjs`
- `doc-maker/ui/scripts/run-framework-worker.mjs`
- `doc-maker/ui/package.json`
- `doc-maker/ui/tests/runtime/framework-store.test.ts`
- `doc-maker/ui/tests/runtime/framework-worker.test.ts`
- `packages/.agent/STATUS.md`
- `packages/.agent/TODO.md`

## 禁止

- 不改 WritingWorker readiness 文件
- 不改 `doc-maker/packages/writing-domain/**`
- 不改 UI 页面/API route
- 不改 `.agent/.eval/.skill/AGENTS/CLAUDE/.agents`
- 不 push，不部署，不碰线上资源

## 回报格式

Task 5 完成后一次性回报：

```markdown
## FrameworkWorker Summary

- Branch:
- Commits:
- Task 4 commands/result:
- Task 5 commands/result:
- Changed files:
- Risks:
- Next actionable:
```
