# TODO

## 当前 in-progress

- [ ] 无

## 下一候选

- [x] Task 8B (WritingWorker): wire `createPgSqlClient` 进 dataset draft API route
- [x] Task 8C (Orchestrator): real Postgres migration + Writing dataset draft/eval integration verification
- [ ] Task 6/9: Writing job integration + release gate（等 runtime/job queue 可用后）

## 已裁决（Orchestrator）

- [x] root `pnpm-lock.yaml` 不纳入版本控制（2026-06-06）：Dockerfile 用 `--no-frozen-lockfile`，build 不依赖 lockfile，新增 `pg` 自动 resolve，零风险。本地 lockfile 不提交。

## 质量门禁

- [x] Task 0 topology contract test 先红后绿
- [x] 禁止 framework schema / package API 出现业务域命名
- [x] 修改跨 package exports 后运行相关 typecheck / unit tests
- [x] Task 1 contract test 先红后绿
- [x] framework-store public API 不出现 `writing_*` / doc-maker 命名
- [x] Task 2 migration test 先红后绿
- [x] Task 3 repository CRUD test 先红后绿
- [x] Task 4 artifact store test 先红后绿
- [x] Task 5 job queue/worker test 先红后绿
- [x] Task 7A dataset repository test 先红后绿
- [x] Task 8A pg→FrameworkSqlClient adapter test 先红后绿（5 tests，fake pool，无真实 PG）
