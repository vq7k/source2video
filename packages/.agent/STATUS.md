# STATUS

## 当前 actionable

**Framework data plane repository wiring 已交棒完成**：Task 8A `createPgSqlClient`（commit `970e289`）已完成；Task 8B Writing provider（commit `c91b5f0`）已接线；Task 8C 由 Orchestrator 于 2026-06-08 用真实 Postgres 验证通过。当前 FrameworkWorker 无 in-progress。

本地 8C 证据：`postgres:16-alpine` on `localhost:5544`，framework migration 建出 10 张表，env-gated integration test 写入 `writing_dataset_draft=1` 与 `writing_eval_dataset=1`。生产启用仍需 Orchestrator 配生产 `FRAMEWORK_DATABASE_URL` 并执行 migration。

**lockfile 决策（Orchestrator 已裁决 2026-06-06）：不纳管**。仓库从未 track `pnpm-lock.yaml`，且 `Dockerfile` 用 `pnpm install --no-frozen-lockfile` —— Docker build 不依赖 lockfile，新增 `pg` 会在 build 时重新 resolve。保持现状、零部署风险。本地生成的 lockfile 不提交。

## 当前阶段

FrameworkWorker 持久身份已初始化；Phase -1 / Task 0 完成。generic framework packages 已迁至仓库根 `packages/`，`doc-maker/packages/` 保留 Writing adapter。

## 最近一次 session

2026-06-08：Orchestrator 完成 8C 本地真实 PG 验证。FrameworkWorker 无需继续等待 8B；后续 framework 任务从 worker queue / artifact store / eval gate 等新任务重新派发。

2026-06-06：完成 Task 8A Postgres SQL client adapter。新增 `packages/framework-store/src/pg-client.ts`（`createPgSqlClient`）+ `pg-client.test.ts`，package.json 加 `pg`/`@types/pg`/`vitest` + `test` script，index.ts export。验证：targeted vitest 5/5 绿（含 RED→GREEN）；全量 `pnpm --dir doc-maker/ui test` 10 files/30 tests 无回归；`pnpm --dir doc-maker/ui typecheck` EXIT=0；`git diff --check` 干净；commit 仅含 4 个 framework 文件（无 doc-maker / .agent / lockfile）。

## 8A/8B/8C 结果

- 8A FrameworkWorker：`createPgSqlClient` 已交付。
- 8B WritingWorker：`FRAMEWORK_DATABASE_URL` provider 已接入。
- 8C Orchestrator：真实 Postgres migration + draft/eval dataset 落库已验证。
- 后续如做生产 data plane，由 Orchestrator 处理生产 env/migration/deploy；FrameworkWorker 等待新的 framework 任务。

## 阻塞

无代码阻塞。不要 push/部署。lockfile 已裁决不纳管（见上）。

## 引用

- 项目入口：`../../PROJECT.md`
- Orchestrator 状态：`../../.agent/STATUS.md`
- Framework data plane 计划：`../../docs/superpowers/plans/2026-06-05-framework-data-plane-plan.md`
- Task 0 handoff：`./sessions/2026-06-05-task-0-package-topology/handoff.md`
- Task 0 Reconcile handoff：`./sessions/2026-06-05-task-0-reconcile/handoff.md`
- Task 1 handoff：`./sessions/2026-06-05-task-1-generic-persistence-contracts/handoff.md`
- Task 2/3 store lane handoff：`./sessions/2026-06-05-task-2-3-store-lane/handoff.md`
- Task 4/5 artifact/runtime lane handoff：`./sessions/2026-06-05-task-4-5-artifact-runtime-lane/handoff.md`
- Task 7A dataset repository lane handoff：`./sessions/2026-06-05-task-7-dataset-repository-lane/handoff.md`
- Writing readiness needs：`../../doc-maker/.agent/sessions/2026-06-05-writing-adapter-readiness/summary.md`
- 本 Worker TODO：`./TODO.md`
