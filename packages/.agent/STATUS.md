# STATUS

## 当前 actionable

**Task 8A Postgres SQL client adapter 已完成**：commit `970e289 feat(framework): add postgres sql client adapter`。已提交未 push。新增 `createPgSqlClient`（pg.Pool → FrameworkSqlClient）+ `pg` runtime dep + `@types/pg`/`vitest` dev dep，export 到 framework-store index。TDD 5 tests 全绿（fake pool，无真实 PG）。

handoff：`./sessions/2026-06-06-task-8a-pg-sql-client/handoff.md`

**lockfile 决策（Orchestrator 已裁决 2026-06-06）：不纳管**。仓库从未 track `pnpm-lock.yaml`，且 `Dockerfile` 用 `pnpm install --no-frozen-lockfile` —— Docker build 不依赖 lockfile，新增 `pg` 会在 build 时重新 resolve。保持现状、零部署风险。本地生成的 lockfile 不提交。

下一步：交棒 **Task 8B（WritingWorker）**——把 `createPgSqlClient` 接进 dataset draft API route。详见下方“交棒 8B”。

## 当前阶段

FrameworkWorker 持久身份已初始化；Phase -1 / Task 0 完成。generic framework packages 已迁至仓库根 `packages/`，`doc-maker/packages/` 保留 Writing adapter。

## 最近一次 session

2026-06-06：完成 Task 8A Postgres SQL client adapter。新增 `packages/framework-store/src/pg-client.ts`（`createPgSqlClient`）+ `pg-client.test.ts`，package.json 加 `pg`/`@types/pg`/`vitest` + `test` script，index.ts export。验证：targeted vitest 5/5 绿（含 RED→GREEN）；全量 `pnpm --dir doc-maker/ui test` 10 files/30 tests 无回归；`pnpm --dir doc-maker/ui typecheck` EXIT=0；`git diff --check` 干净；commit 仅含 4 个 framework 文件（无 doc-maker / .agent / lockfile）。

## 交棒 8B（WritingWorker）

- import：`import { createPgSqlClient } from "@source2video/framework-store";`
- 用法 A（推荐，service 自管生命周期）：`const sql = createPgSqlClient({ connectionString: process.env.DATABASE_URL! });` → 传给 `createPostgresDatasetRepository(sql)`；进程关停时 `await sql.close()`（connectionString 分支 owns pool）。
- 用法 B（复用既有 Pool）：`createPgSqlClient({ pool })`；`close()` 默认 no-op（caller 自管），需委托关闭传 `{ pool, ownsPool: true }`。
- 类型：`PgSqlClient = FrameworkSqlClient & { readonly pool; close(): Promise<void> }`，`PgSqlClientInput` 也已 export。
- **8B 必须处理 bundling**：一旦 Next.js app/route 运行时 import framework-store（会传递 import `pg`），需把 `pg` 加进 `next.config.ts` 的 `serverExternalPackages`，避免 Next 打包 pg。8A 未触发（当前无 app 运行时 import framework-store）。

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
