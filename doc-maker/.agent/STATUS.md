# STATUS

## 当前 actionable

**Task 8B Writing Postgres Dataset Draft Provider 已完成**：dataset draft API 接上了 env 驱动的生产 provider。`FRAMEWORK_DATABASE_URL` 配置时 → `createPgSqlClient` + `createPostgresDatasetRepository`（lazy 单例缓存 client）真实 Postgres path；未配置时 → null 维持 503；test override 仍优先。

commit：`c91b5f0 feat(writing): wire postgres dataset draft repository provider`

接线点改动（仅 doc-maker/ui）：
- `ui/lib/writing-dataset-draft-repository.ts`：新增 `resolveDefaultRepository()`（读 env + lazy 单例）。
- `ui/tsconfig.json` + `ui/vitest.config.ts`：加 `@source2video/framework-store` 解析（之前完全不可解析）。
- `ui/next.config.ts`：加 `serverExternalPackages: ["pg"]`。
- 新增 `ui/tests/runtime/writing-dataset-draft-repository-provider.test.ts`（TDD 先红后绿，4 tests）。

下一步（交棒 Task 8C）：真实 PG migration + 连接验证 + 部署接线。注意 build 实证发现见下方“阻塞/风险”。
上游 8A 交付：`../../packages/.agent/sessions/2026-06-06-task-8a-pg-sql-client/handoff.md`
Task 7C handoff：`.agent/sessions/2026-06-05-task-7c-writing-dataset-persistence/handoff.md`
上游 summary：`.agent/sessions/2026-06-05-writing-adapter-readiness/summary.md`

## 当前阶段

Writing Production v1 已完成线上闭环验收；下一阶段从“业务闭环”转向“作为 framework 第一个 adapter 复用数据/规则/eval”。

## 最近一次 session

2026-06-06：完成 Task 8B。TDD 先红（env 配 → 期望非 null/200，旧 provider 恒 null → 红）后绿。验证：targeted vitest 4/4、`pnpm test` 11 files / 34 tests（基线 ~30，+4 无回归）、`pnpm typecheck` 0、`pnpm build` 成功、`git diff --check` / `git diff --cached --check` 干净、commit 仅含 doc-maker/ui 5 文件（不含 root packages/.agent/lockfile）。

## 阻塞

无代码阻塞，但有一条 build 实证需交棒 Task 8C/部署：
- **`serverExternalPackages: ["pg"]` 实测未能阻止 pg 被打包**。A/B 验证（加/不加该项）route bundle 中 pg 源码 token（SASL/SCRAM/readyForQuery/DatabaseError）完全一致，且都无 `require("pg")` 外部标记——因为 pg 是经 `externalDir` 一方源码（`packages/framework-store/src/pg-client.ts`）引入的，Next 把它内联进了 route bundle。
- **但 build 两种情况都成功、零 warning**（Next 15.1.4 + pg 8.21 打包 pg 不报错），handoff 担心的“原生 pg 打进 bundle 出错”未发生。
- **当前打包反而对 standalone 更安全**：`outputFileTracingRoot` = `doc-maker`，而 pg 在 repo-root/`packages/framework-store/node_modules`（trace root 之外），若真外部化反会导致 standalone `Cannot find module 'pg'`。故保留 `serverExternalPackages: ["pg"]`（正确意图 + 防未来拓扑变化），不强制 webpack externals。
- 真实 PG migration/连接验证/部署仍需 Task 8C。禁止修改 root `packages/**`。

## 引用

- 项目入口：`../../PROJECT.md`
- doc-maker 入口：`../CLAUDE.md`
- Orchestrator 状态：`../../.agent/STATUS.md`
- 本 Worker TODO：`./TODO.md`
- Adapter readiness handoff：`.agent/sessions/2026-06-05-writing-adapter-readiness/handoff.md`
- Adapter readiness summary：`.agent/sessions/2026-06-05-writing-adapter-readiness/summary.md`
- Task 7B handoff：`.agent/sessions/2026-06-05-task-7b-writing-dataset-adapter/handoff.md`
