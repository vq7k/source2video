# STATUS

## 当前 actionable

**Writing dataset closure 已完成**：Task 8B env-driven provider（commit `c91b5f0`）已接入；2026-06-08 Orchestrator 补齐人工确认 promotion 和真实 PG 8C 验证。当前无 WritingWorker in-progress。

新增闭环：
- draft：`POST /api/writing-runs/[runId]/dataset-drafts` 写 `writing_dataset_draft`，`reviewStatus=needs_human_confirmation`。
- confirmation：`POST /api/writing-runs/[runId]/dataset-drafts/confirm` 要求 `confirmedBy`，复制进入 `writing_eval_dataset`，`split=validation`，`reviewStatus=human_confirmed`。
- 真实 PG：`RUN_POSTGRES_INTEGRATION=1 FRAMEWORK_DATABASE_URL=... pnpm --dir doc-maker/ui exec vitest run tests/runtime/writing-dataset-postgres.integration.test.ts` 通过。

下一步由 Orchestrator 决定：生产 `FRAMEWORK_DATABASE_URL` + migration + 线上 route 验收，或继续 Writing JSON run/rule stores adapter 化。

## 当前阶段

Writing Production v1 已完成线上闭环验收；下一阶段从“业务闭环”转向“作为 framework 第一个 adapter 复用数据/规则/eval”。

## 最近一次 session

2026-06-08：Orchestrator 完成 dataset confirmation closure。新增 `promoteWritingDatasetDraftsForRun()`、`/dataset-drafts/confirm` route、env-gated Postgres integration test；OpenSpec 13.4/13.5 已勾选；一次性 Docker Postgres 验证 draft/eval dataset 各 1 条落库。

2026-06-06：完成 Task 8B。TDD 先红（env 配 → 期望非 null/200，旧 provider 恒 null → 红）后绿。验证：targeted vitest 4/4、`pnpm test` 11 files / 34 tests（基线 ~30，+4 无回归）、`pnpm typecheck` 0、`pnpm build` 成功、`git diff --check` / `git diff --cached --check` 干净、commit 仅含 doc-maker/ui 5 文件（不含 root packages/.agent/lockfile）。

## 阻塞

无代码阻塞，但有一条 build 实证需带入生产部署：
- **`serverExternalPackages: ["pg"]` 实测未能阻止 pg 被打包**。A/B 验证（加/不加该项）route bundle 中 pg 源码 token（SASL/SCRAM/readyForQuery/DatabaseError）完全一致，且都无 `require("pg")` 外部标记——因为 pg 是经 `externalDir` 一方源码（`packages/framework-store/src/pg-client.ts`）引入的，Next 把它内联进了 route bundle。
- **但 build 两种情况都成功、零 warning**（Next 15.1.4 + pg 8.21 打包 pg 不报错），handoff 担心的“原生 pg 打进 bundle 出错”未发生。
- **当前打包反而对 standalone 更安全**：`outputFileTracingRoot` = `doc-maker`，而 pg 在 repo-root/`packages/framework-store/node_modules`（trace root 之外），若真外部化反会导致 standalone `Cannot find module 'pg'`。故保留 `serverExternalPackages: ["pg"]`（正确意图 + 防未来拓扑变化），不强制 webpack externals。
- 本地真实 PG migration/连接验证已由 Orchestrator 在 8C 跑通；生产启用仍需配置 `FRAMEWORK_DATABASE_URL` 并对生产 PG 执行 migration。禁止修改 root `packages/**`。

## 引用

- 项目入口：`../../PROJECT.md`
- doc-maker 入口：`../CLAUDE.md`
- Orchestrator 状态：`../../.agent/STATUS.md`
- 本 Worker TODO：`./TODO.md`
- Adapter readiness handoff：`.agent/sessions/2026-06-05-writing-adapter-readiness/handoff.md`
- Adapter readiness summary：`.agent/sessions/2026-06-05-writing-adapter-readiness/summary.md`
- Task 7B handoff：`.agent/sessions/2026-06-05-task-7b-writing-dataset-adapter/handoff.md`
