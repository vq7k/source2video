# Handover — Repository Wiring (Task 8A/8B/8C) — 2026-06-06

> Orchestrator session 交接。**本 session 后期终端渲染损坏**（命令文本回显、整行重复、Read 把 53 行 package.json 显示成 ~3700 行幻觉、docker 假“成功”输出）。用户将重启 runtime。**这份 handover 是自包含的 source of truth**；重启后先按文末「重启后复核清单」核对，再继续。

## 一句话现状

让 Writing dataset draft API 从 `503 repository_unconfigured` 进入真实 Postgres persistence。代码侧（8A+8B）**已完成并验收**；真实 PG 端到端验证（8C）**只完成环境探路，实质未做**。

## 角色 & 背景

- 我 = **Orchestrator**（cwd = 仓库根 `/Users/xuelin/projects/source2video`，分支 `codex/framework-topology`）。
- 持久 Worker：FrameworkWorker（`packages/`）、WritingWorker（`doc-maker/`）。横切（Infra/QA）走临时 SubAgent，但 8C 这类环境敏感活由 Orchestrator 自己分步跑。
- 任务拆三段：**8A**（FrameworkWorker，pg adapter）→ **8B**（WritingWorker，生产 provider 接线）→ **8C**（真实本地 PG migration + 端到端落库验证）。

## 已完成且可信（git 历史已复核）

| 项 | 结论 | 证据 |
|---|---|---|
| QA 复验 Task 0 (`bda65dd`) | **PASS** | `.agent/sessions/2026-06-05-qa-task0-review/report.md`（拓扑干净，topology 5/5、test 30/30、typecheck 0） |
| Infra local data plane readiness | env = `FRAMEWORK_DATABASE_URL` | `.agent/sessions/2026-06-05-infra-local-data-plane-readiness/report.md`（Postgres 接线代码已就绪；artifact filesystem first；S3/MinIO=`ARTIFACT_STORE_*` 后置） |
| **Task 8A** pg→FrameworkSqlClient adapter | **已验收** | commit `970e289`；`packages/framework-store/src/pg-client.ts` 的 `createPgSqlClient`（业务无关、lifecycle-aware close）+ `pg`/`@types/pg` dep；5 TDD 测试 fake pool；commit 仅 framework-store 4 文件 |
| **Task 8B** Writing 生产 provider 接线 | **已验收** | commit `c91b5f0`；改 5 文件全在 `doc-maker/ui/**`（见下）；自验 targeted 4/4、全量 11 files/34 tests、typecheck 0、`next build` 成功零 warning |
| lockfile 裁决 | **不纳管** | 仓库从未 track `pnpm-lock.yaml` 且 Dockerfile 用 `pnpm install --no-frozen-lockfile`，Docker build 不依赖 lockfile，零风险 |

### 8A 交付的 API（8B 已在用）
```ts
import { createPgSqlClient, createPostgresDatasetRepository } from "@source2video/framework-store";
const sql = createPgSqlClient({ connectionString });        // 或 { pool, ownsPool? }
const repo = createPostgresDatasetRepository(sql);          // DatasetRepository，结构兼容 WritingDatasetDraftRepository
// connectionString 分支 owns pool，close() 会 pool.end()
```

### 8B 改的 5 个文件（commit c91b5f0，仅 doc-maker/ui/**）
- `ui/lib/writing-dataset-draft-repository.ts` — env 驱动默认 provider：读 `FRAMEWORK_DATABASE_URL`，有值→lazy 单例真实 Postgres repo，无值→null（维持 503），`setWritingDatasetDraftRepositoryProviderForTests` override 优先
- `ui/tsconfig.json` + `ui/vitest.config.ts` — 加 `@source2video/framework-store` alias（此前不可解析）
- `ui/next.config.ts` — 加顶层 `serverExternalPackages: ["pg"]`
- `ui/tests/runtime/writing-dataset-draft-repository-provider.test.ts` — 新增 4 个 integration test（fake SQL client，不连真实 PG）

## Task 8C 真实状态（⚠️ 勿高估）

- user 已拍板 PG 来源 = **一次性 `docker run postgres:16`**。
- **实际只完成环境探路**：
  - docker **27.5.1 可用** ✓
  - 本机 **`psql` 不在 PATH**（libpq 未装）→ `pnpm framework:migrate`（spawnSync psql）本机会失败
  - **主机 5432 已被 `langfuse-postgres-1` 占用**（`0.0.0.0:5432->5432`）→ 起容器必须换主机端口
- **❌ 假进度纠正**：本 session 一屏显示“容器 s2v-pg-8c ready / migrate_exit=0 / 10 张表建出”，是终端渲染损坏期的**假输出**。干净 `docker ps -a` 证明 **`s2v-pg-8c` 容器从未创建**（docker run 因 5432 冲突失败）、**migration 从未真跑**。已沉淀为 learned-rules L3。
- 预期**无残留 s2v 容器**（run 失败了），但重启后仍要 `docker ps -a | grep s2v` 复核。

## Task 8C 待办（重启后执行，命令已备好）

用**非 5432 主机端口**（如 5544）。连接串 = `postgres://postgres:s2v@localhost:5544/source2video_framework`。

```bash
cd /Users/xuelin/projects/source2video
# 1. 起一次性容器（非 5432）
docker rm -f s2v-pg-8c 2>/dev/null
docker run -d --name s2v-pg-8c -e POSTGRES_PASSWORD=s2v -e POSTGRES_DB=source2video_framework -p 5544:5432 postgres:16
# 等就绪：docker exec s2v-pg-8c pg_isready -U postgres -d source2video_framework

# 2. 跑 migration（用容器内 psql，绕过本机 psql 缺失）
docker exec -i s2v-pg-8c psql -v ON_ERROR_STOP=1 -U postgres -d source2video_framework \
  < packages/framework-store/migrations/0001_framework_core.sql
# 验证 10 表：docker exec s2v-pg-8c psql -U postgres -d source2video_framework -c "\dt"

# 3. L1 真实落库验证（核心）：临时 node/vitest 脚本
#    createPgSqlClient({connectionString:'postgres://postgres:s2v@localhost:5544/source2video_framework'})
#    -> createPostgresDatasetRepository(sql)
#    -> persistWritingDatasetDraftsForRun(createWritingRunFixture(), repo)
#    -> 查 framework_dataset_items 应有行
#    fixture: doc-maker/packages/writing-domain/src/testing/run-fixture.ts (createWritingRunFixture)
#    persist:  doc-maker/packages/writing-domain/src/dataset-draft-persistence.ts

# 4.（可选 L2）验证部署用的 migrate 脚本本身
brew install libpq && export PATH="/opt/homebrew/opt/libpq/bin:$PATH"
FRAMEWORK_DATABASE_URL='postgres://postgres:s2v@localhost:5544/source2video_framework' \
  pnpm --dir doc-maker/ui framework:migrate

# 5. 清理
docker rm -f s2v-pg-8c
```

DoD：migration 建出 10 表 + L1 脚本真把 dataset draft items 写进 `framework_dataset_items` 并能读回。

## 8C 部署注意（8B 实测发现，必须带入）

当前 `pg` **被内联进 Next bundle** —— `serverExternalPackages:["pg"]` 在 `experimental.externalDir:true` + `outputFileTracingRoot=doc-maker` 拓扑下名义存在但**实测不外部化**（pg 在 trace root 外的 root `packages/framework-store/node_modules`）。内联对 standalone 自包含部署更安全，build 零 warning。**若 8C/部署改真外部化 pg**，必须保证 standalone 能拿到 pg（调 trace root / 让 pg 进 doc-maker 依赖树 / Docker 显式拷贝），与 `521f3c2 fix(deploy): include framework packages` 一并核对。

## 重启后复核清单（第一件事）

1. `git log --format='%h %s' -6 | cat`：确认 `970e289`(8A)、`c91b5f0`(8B) 在历史；注意中间有 `9bf45ac docs(orchestrator)` 同步 commit（来源存疑，可 `git show --stat 9bf45ac` 看是否只动 .agent，无害则忽略）。当前 HEAD 应为 `970e289`。
2. `docker ps -a | grep s2v`：应无残留；有则 `docker rm -f`。
3. **复核状态文件本轮改动是否落盘**（本 session 末多次 Edit 被中断/渲染干扰，可能未全部生效）：
   - `.agent/STATUS.md` 当前 actionable 是否写了「8A+8B 已验收、8C 仅探路、5432 被 langfuse 占用」
   - `.agent/TODO.md` 是否有 8C 分步 + 非 5432 端口约束
   - `.agent/learned-rules.md` 是否有 **L3**（终端渲染损坏 → 副作用操作必须独立只读复核 + 5432 被占）
   - **缺则以本 handover 为准补齐**。
4. 确认无未提交的意外改动：`git status --short`（8A/8B 已提交；本 session 只动 `.agent/**` 文档，未碰代码）。

## 关键路径索引

- framework pg adapter：`packages/framework-store/src/pg-client.ts`、`src/index.ts`、`src/repositories/datasets.ts`、`src/db.ts`
- migration：`packages/framework-store/migrations/0001_framework_core.sql`、脚本 `doc-maker/ui/scripts/migrate-framework-store.mjs`（读 `FRAMEWORK_DATABASE_URL`，shell out psql）
- Writing provider：`doc-maker/ui/lib/writing-dataset-draft-repository.ts`、route `doc-maker/ui/app/api/writing-runs/[runId]/dataset-drafts/route.ts`、persist `doc-maker/packages/writing-domain/src/dataset-draft-persistence.ts`、fixture `doc-maker/packages/writing-domain/src/testing/run-fixture.ts`
- handoff：`packages/.agent/sessions/2026-06-06-task-8a-pg-sql-client/handoff.md`、`doc-maker/.agent/sessions/2026-06-06-task-8b-writing-pg-provider/handoff.md`
- 本 handover：`.agent/sessions/2026-06-06-repository-wiring/handover.md`

## learned-rule L3（若 learned-rules.md 未落盘，补这条）

**L3: 终端渲染损坏期的工具输出不可信，副作用操作必须独立只读复核（2026-06-06）** — 渲染异常（命令回显/整行重复/超长幻觉）时不得据此判定 docker run/migration/写文件/部署是否成功，必须另跑最简只读命令（`docker ps -a`、`wc -l`、`git status`）复核，绝不让可疑“成功”进 STATUS。环境事实：本机主机 5432 被 `langfuse-postgres-1` 占用，s2v 本地 PG 用其他端口（如 5544）。
