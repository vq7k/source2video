# WritingWorker Handoff — Task 8B: Writing dataset draft 生产 provider 接线

> 归档说明：本 handoff 原在渲染损坏期创建，Write 假成功未落盘，事后（2026-06-06）补写。Task 8B 已实际完成（commit `c91b5f0`）——subagent 当时靠派发 prompt 内联的完整任务描述执行，未受文件缺失影响。本文件留作归档完整性。

## 任务身份

source2video 持久 **WritingWorker**（cwd = `doc-maker/`）。只动 `doc-maker/**`，不改 root `packages/**`（8A 产物）。

## 目标

让 `POST /api/writing-runs/[runId]/dataset-drafts` 从 `503 repository_unconfigured` 进入真实 Postgres persistence path。

## 实现要点（已完成）

1. `ui/lib/writing-dataset-draft-repository.ts`：加读 `process.env.FRAMEWORK_DATABASE_URL` 的默认生产 provider——有值 → `createPgSqlClient({connectionString})` → `createPostgresDatasetRepository(sql)`（lazy 单例缓存）；无值 → null（维持 503）；`setWritingDatasetDraftRepositoryProviderForTests` override 优先。
2. `ui/tsconfig.json` + `ui/vitest.config.ts`：加 `@source2video/framework-store` alias（此前不存在，否则 import 解析不了）。
3. `ui/next.config.ts`：加顶层 `serverExternalPackages:["pg"]`。
4. integration test 用 fake SQL client（不连真实 PG）。

## 边界

- 可写：`doc-maker/ui/{lib,app/api/writing-runs/**,tsconfig.json,vitest.config.ts,next.config.ts}` + 测试。
- 禁止：root `packages/**`、真实 PG/migration/部署/push。

## 验收结果（commit c91b5f0）

- 改 5 文件全在 `doc-maker/ui/**`，未碰 root packages、未动 writing-domain。
- 自验：targeted 4/4 先红后绿、全量 11 files/34 tests、typecheck 0、`next build` 成功零 warning。
- 关键发现：`serverExternalPackages:["pg"]` 在 externalDir + `outputFileTracingRoot=doc-maker` 拓扑下实测不外部化，pg 被内联进 bundle（对 standalone 自包含部署更安全）。

## 交棒（已被 8C 消费）

- import：`import { createPgSqlClient, createPostgresDatasetRepository } from "@source2video/framework-store";`
- env 名 `FRAMEWORK_DATABASE_URL`。
- 8C 已用真实 PG（5544 docker postgres:16）验证此 provider 链路落库通过。
