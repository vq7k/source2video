# Session Summary — Repository Wiring (Task 8A/8B/8C) — 2026-06-06

> 给下一个 agent 的无缝衔接总结。读这份 + 同目录 `handover.md` 即可接手，无需回溯对话。
> 角色：Orchestrator（cwd = 仓库根 `/Users/xuelin/projects/source2video`，分支 `codex/framework-topology`）。

---

## 0. 一句话现状

让 Writing dataset draft API 从 `503 repository_unconfigured` 进入真实 Postgres persistence。**代码侧 8A+8B 已验收提交（`970e289`/`c91b5f0`），8C 真实 PG 端到端验证本 session 直跑通过；repository wiring 三段全部闭环。** 仅 `.agent/**` 状态文档尚未 git commit（代码已提交）。无代码阻塞，下一步是产品优先级决策。

---

## 1. 仓库/分支重要事实（接手必读）

- **纯本地 git 仓库**：`git remote -v` 为空，**无任何 remote**。
- **只有一个分支 `codex/framework-topology`，无本地 `main`**（`main` 解析为 unknown revision）。
- 环境 harness 显示的 "Main branch: main" 是默认约定，**与实际不符**。
- STATUS 记的"push CodeUp `main` 部署"机制**不在这个工作副本**（部署副本/remote 在别处）。
- ⚠️ **分支怎么处理是 open question**，待 user 给 CodeUp 接入方式后定（独立工作副本同步 / 配 remote 直推 / 把本分支转正 main）。本 session 工作提交在 `codex/framework-topology` 上是安全的。

---

## 2. 本 session 时间线

1. catch-up（Orchestrator 自报）。起点：Task 7C 已完成，下一步 repository provider wiring。
2. 派 QA + Infra 两个临时 SubAgent 回报前置（并行）：
   - QA 复验 Task 0 `bda65dd` 拓扑 → **PASS**（report 在 `.agent/sessions/2026-06-05-qa-task0-review/report.md`）。
   - Infra readiness → 唯一必需 env=`FRAMEWORK_DATABASE_URL`（report 在 `.agent/sessions/2026-06-05-infra-local-data-plane-readiness/report.md`）。
3. 设计 wiring 拆 8A/8B/8C。
4. 8A（FrameworkWorker）：subagent 中途 ECONNRESET 但已完整提交 `970e289` + 自验 + 升级 lockfile。验收通过。
5. lockfile 裁决：不纳管。
6. 8B（WritingWorker）：提交 `c91b5f0`，验收通过。
7. 8C（Orchestrator 直跑）：渲染损坏期一度误判 docker 假成功；干净复核纠正，5544 端口重做，真实 PG 落库验证通过。
8. 收尾：刷新 STATUS/TODO/learned-rules + handover + 本总结。

---

## 3. 三段产出（全部已验收/完成）

### 8A（commit `970e289`，仅 `packages/framework-store/` 4 文件）
- `src/pg-client.ts`：`createPgSqlClient(input)`，input = `{ connectionString, poolConfig? }` 或 `{ pool, ownsPool? }`，返回 `PgSqlClient = FrameworkSqlClient & { readonly pool; close(): Promise<void> }`。connectionString 分支 owns pool；注入 pool 默认 close() no-op。
- `src/index.ts` export；`package.json` 加 `pg ^8.13.1` + `@types/pg`。5 TDD fake-pool 测试。命名业务无关。
- 契约：`FrameworkSqlClient.query<T>(sql,params)→{rows:T[]}`，与 `pg.Pool.query` 天然对齐。

### 8B（commit `c91b5f0`，仅 `doc-maker/ui/**` 5 文件）
- `ui/lib/writing-dataset-draft-repository.ts`：env 驱动 lazy 单例 provider。读 `FRAMEWORK_DATABASE_URL`，有值→`createPgSqlClient`+`createPostgresDatasetRepository`（缓存单例）；无值→null（503）。test setter override 优先。
- `ui/tsconfig.json` + `ui/vitest.config.ts`：加 `@source2video/framework-store` alias（**此前不存在，是接线必须**）。
- `ui/next.config.ts`：加顶层 `serverExternalPackages:["pg"]`。
- 4 个 fake-client integration test。类型：`DatasetRepository` 结构兼容 `WritingDatasetDraftRepository`，未动 writing-domain/root packages。
- 自验：targeted 4/4、全量 34 tests、typecheck 0、`next build` 零 warning。

### 8C（本 session 直跑，证据见 handover.md，无 commit=验证任务）
- docker `postgres:16`，**主机端口 5544**（避开被 `langfuse-postgres-1` 占用的 5432），DB=`source2video_framework`/密码 `s2v`。
- migration：`docker exec -i ... psql < packages/framework-store/migrations/0001_framework_core.sql` → 建 10 表。
- L1：env-gated 一次性 vitest 连真实 PG → `createPgSqlClient`+`createPostgresDatasetRepository`+`persistWritingDatasetDraftsForRun(createWritingRunFixture())` → `framework_dataset_items`=1 / `framework_datasets`=2，2 tests passed。
- 收尾：容器删、临时测试删、`git status` 无痕。
- **L2 未做（可选）**：`brew install libpq` 后跑 `pnpm framework:migrate` 验部署脚本本身（migration SQL 已被容器内 psql 证明有效）。

---

## 4. 关键决策（已拍板）

1. lockfile 不纳管（仓从未 track，Dockerfile `--no-frozen-lockfile`，零风险）。
2. 8C PG 来源 = 一次性 docker postgres:16（user 拍板）。
3. 8C 跳过 L2（不在本机 brew install libpq，留给部署/CI）。
4. 8C 不留交付代码（验证任务，临时 test 跑完即删）。
5. 8C 用 5544 端口（5432 被 langfuse 占用）。

---

## 5. 当前数据流真相

- route `doc-maker/ui/app/api/writing-runs/[runId]/dataset-drafts/route.ts`：`runtime="nodejs"`，调 `getWritingDatasetDraftRepository()`→null 则 503，否则 `persistWritingDatasetDraftsForRun`。
- provider：`ui/lib/writing-dataset-draft-repository.ts`，test setter 优先 → 否则读 `FRAMEWORK_DATABASE_URL`。
- **生产现状**：线上未配 `FRAMEWORK_DATABASE_URL`，所以线上 dataset route **仍按设计 503**——预期，非 bug。上线 data plane 须配生产 PG env。
- import 解析：`@source2video/framework-store`→`../../packages/framework-store/src/index`（8B 加）；`@doc-maker/writing-domain/*`→`../packages/writing-domain/src/*`（既有）。next.config 用 `experimental.externalDir:true`+`output:standalone`+`outputFileTracingRoot=doc-maker`。

---

## 6. 部署注意（带入未来）

`pg` 被**内联进 Next bundle**——`serverExternalPackages:["pg"]` 在 externalDir + `outputFileTracingRoot=doc-maker` 拓扑下**实测不外部化**（pg 在 trace root 外）。8B 做过 A/B build 验证，加/不加该项 bundle 一致。**内联对 standalone 自包含部署更安全**，build 零 warning。若改真外部化须保证 standalone 拿得到 pg（调 trace root / 让 pg 进 doc-maker 依赖树 / Docker 拷贝），与 `521f3c2 fix(deploy): include framework packages` 一并核对。

---

## 7. 本 session 重大踩坑 → learned-rules L3（务必内化）

**终端渲染长时间损坏**：命令文本回显、整行重复、Read 把 53 行 package.json 显示成 ~3700 行幻觉、docker run 失败被显示成假成功、**Write 返回"成功"但文件实际未落盘**（session-summary.md / 8B handoff 都中招，事后用 `test -f` 才发现，已重写）。

**learned-rules L3**：渲染异常时不得据此判定有副作用操作（docker run/migration/写文件/部署/push/**Write 落盘**）成功，必须另跑最简只读命令（`docker ps -a`、`test -f`、`wc -l`、`git status`、`git show --stat`）复核。**本机 5432 被 `langfuse-postgres-1` 占用，s2v 本地 PG 用 5544。**

**抗损坏手法**（渲染再坏可复用）：命令关键结果写 `/tmp/xxx.txt` 受控小文件，再 Read 读回判断真相，绕开终端 stdout 回显；Write 后用 `test -f`+`wc -l` 核实落盘。

---

## 8. 下一步候选（待 user 拍优先级，无代码阻塞）

- **(a)** 让 data plane 上线：配生产 `FRAMEWORK_DATABASE_URL` → migration → 线上 dataset route 转真实落库。需决策生产 PG 形态 + 处理 §6 部署注意。
- **(b)** 数据飞轮下一环：dataset item → eval 回放输入。
- **(c)** framework data plane 其余模块：worker queue / artifact store / dataset/eval/gate 端到端。
- **(d)** 其它里程碑：doc-maker writing production 下一阶段 / video-maker / tts-maker / s2v-core 抽离。

---

## 9. 接手第一件事（sanity check）

1. `git status --short`：本 session `.agent/**` 文档**未 commit**（8A `970e289`、8B `c91b5f0` 代码已 commit）。工作区还有大量**非本 session 遗留改动**（AGENTS.md/CLAUDE.md/PROJECT.md/.eval/.agents/ + 一批 2026-06-05 sessions 归档 + doc-maker docs），TODO 标"待决断·本次不重排"，**别一股脑提交**。
2. `docker ps -a | grep s2v`：应无残留容器。
3. `git log --oneline -4`：见 `970e289`/`c91b5f0`（历史中有 `9bf45ac docs(orchestrator)` 同步 commit，来源存疑但无害）。
4. **分支策略未定**：先问 user CodeUp 接入方式（见 §1）。

---

## 10. 关键路径索引

- 8A：`packages/framework-store/src/pg-client.ts`、`src/index.ts`、`src/db.ts`、`src/repositories/datasets.ts`
- migration：`packages/framework-store/migrations/0001_framework_core.sql`；脚本 `doc-maker/ui/scripts/migrate-framework-store.mjs`（读 `FRAMEWORK_DATABASE_URL`，shell out psql）
- 8B：`doc-maker/ui/lib/writing-dataset-draft-repository.ts`、`ui/app/api/writing-runs/[runId]/dataset-drafts/route.ts`、`ui/tsconfig.json`、`ui/vitest.config.ts`、`ui/next.config.ts`
- Writing domain：`doc-maker/packages/writing-domain/src/dataset-draft-persistence.ts`、`src/testing/run-fixture.ts`（`createWritingRunFixture`）
- handoff：`packages/.agent/sessions/2026-06-06-task-8a-pg-sql-client/handoff.md`、`doc-maker/.agent/sessions/2026-06-06-task-8b-writing-pg-provider/handoff.md`
- 本 session 目录：`.agent/sessions/2026-06-06-repository-wiring/`（`handover.md` + `session-summary.md`）
