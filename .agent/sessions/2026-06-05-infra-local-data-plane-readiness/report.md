## Infra Readiness Summary

- Result: 只读调研完成，未改任何线上/云/Caddy 资源，未启动长期服务。结论：仓内 Postgres 接线代码已就绪（migrations + repositories 已写），但本地缺两块前置——(1) 本机无 `psql` 客户端（migrate 脚本 shell out 到 `psql`，会直接失败）；(2) dataset repository provider 在生产路径完全没接线（只有 test setter），且全仓没有 `pg` 依赖。Task 2 跑 migration 只需一个环境变量 + 一个可达 Postgres + psql 二进制；真正让 `/api/.../dataset-drafts` 落库还需补一个 PG-backed provider。

- Existing config:
  - 根 `docker-compose.yml`：单 Next.js 容器 `source2video`，复用外部网络 `infra_ftai-net` + `ftai-caddy`。无 postgres / minio / 任何 data 服务。持久化全是 filesystem 卷：`./data/writing-runs`、`./data/rule-packages`、`./data/runtime`。
  - 根 `Dockerfile`：Next.js standalone，构建期跑 `pnpm test && pnpm build`。运行时未注入任何 DB / artifact-store env。
  - 无 `.env.example`（handoff 命令里引用的文件不存在，全仓没有）。`.env` / `.env.local` 已 gitignore。唯一现存 env 文件 `doc-maker/ui/.env.local` 仅含 5 个 Langfuse Cloud 变量（指向 `https://us.cloud.langfuse.com`）。
  - `docs/deploy.md` / 服务器 `/opt/source2video/.env`：只有 `DOC_MAKER_LLM_*` + Langfuse，无 DB 变量。
  - Migration 资产已存在：`packages/framework-store/migrations/0001_framework_core.sql`（10 张表，含 `framework_datasets` / `framework_dataset_items` / `framework_jobs` / `framework_workflow_runs` 等），脚本 `doc-maker/ui/scripts/migrate-framework-store.mjs`，npm script `pnpm framework:migrate`。
  - Repository 代码已就绪：`packages/framework-store/src/repositories/{datasets,workflow-runs,jobs,artifacts}.ts`，对外暴露 `createPostgresDatasetRepository(client)` 等，依赖一个极简 `FrameworkSqlClient`（`query<T>(sql, params) => {rows}`，正好等同 node-postgres `pg.Pool.query` 形状）。
  - Artifact store：`packages/artifact-store/src/index.ts` 的 filesystem adapter 已可用（`createFilesystemArtifactStore({rootDir})`，sha256 寻址）；`src/minio.ts` 的 S3 兼容 adapter 是 stub，`putObject/getObject` 直接 throw "not wired to an SDK"。
  - 本机工具：`psql` 不在 PATH、无本地 Postgres server 二进制；`docker` 可用（29.2.1）。

- Proposed local services:
  - Postgres（必需）：用户另一项目已有 PG → 首选在该实例上建独立库 `source2video_framework`（别共用表），避免新起长期服务。若不想碰那个实例，再用一次性 docker 容器（`docker run --rm -p 5432:5432 -e POSTGRES_PASSWORD=... postgres:16`）做 dev——dev 临时容器可接受，但不要写进 compose / 不要常驻。
  - psql 客户端（必需）：migrate 脚本 spawn `psql`，本机缺 → `brew install libpq && brew link --force libpq`（或 `brew install postgresql@16`）。不装则 Task 2 无法跑 migration。
  - Artifact store：filesystem first，`createFilesystemArtifactStore({ rootDir })`，本地用 `./data/framework-artifacts`（tests 用 `.test-artifacts/framework-artifacts`）。无需 env。MinIO/OSS optional——但 S3 adapter 当前是 stub，接 MinIO 前要先补 SDK 实现，本阶段不要依赖 MinIO。
  - Langfuse：保持 Cloud Free，沿用现有 `doc-maker/ui/.env.local`，不动。

- Env vars:
  - Task 2 migrations 唯一必需：`FRAMEWORK_DATABASE_URL`（`doc-maker/ui/scripts/migrate-framework-store.mjs:11` 读取；`pnpm framework:migrate` 触发）。示例 `postgres://USER:PASS@HOST:5432/source2video_framework`。
  - Dataset repository provider 接线所需：同样是 `FRAMEWORK_DATABASE_URL`（provider 要据此建 `pg.Pool`）。目前没有任何代码在生产路径读它建连接——只有 migrate 脚本读。
  - Artifact S3/MinIO/OSS（Task 4，后置）：`ARTIFACT_STORE_ENDPOINT`、`ARTIFACT_STORE_BUCKET`、`ARTIFACT_STORE_ACCESS_KEY_ID`、`ARTIFACT_STORE_SECRET_ACCESS_KEY`，可选 `ARTIFACT_STORE_REGION`、`ARTIFACT_STORE_PREFIX`（`packages/artifact-store/src/minio.ts:15-31`）。filesystem 模式不读 env，由调用方传 `rootDir`。
  - Langfuse（不变）：`LANGFUSE_BASE_URL`(或 `LANGFUSE_HOST`)、`LANGFUSE_PUBLIC_KEY`、`LANGFUSE_SECRET_KEY`、`LANGFUSE_ENVIRONMENT`、`LANGFUSE_PROJECT_ID`（`packages/observability/src/langfuse.ts:29-39`）。
  - LLM（不变）：`DOC_MAKER_LLM_PROVIDER`、`DOC_MAKER_LLM_BASE_URL`、`DOC_MAKER_LLM_MODEL`、`DOC_MAKER_LLM_API_KEY`。

- Risks:
  - Provider 接线缺口（最大）：`doc-maker/ui/lib/writing-dataset-draft-repository.ts` 只有 `setWritingDatasetDraftRepositoryProviderForTests`，无生产 provider；`getWritingDatasetDraftRepository()` 生产恒返回 null → `POST /api/writing-runs/[runId]/dataset-drafts` 恒返回 503 `repository_unconfigured`。要落库必须新增：(a) `pg` 依赖（全仓现无）；(b) `FrameworkSqlClient` over `pg.Pool` 的薄适配；(c) 读 `FRAMEWORK_DATABASE_URL` 建池并返回 `createPostgresDatasetRepository` 的生产 provider。
  - psql 缺失：不装客户端，migrate 脚本静默失败（脚本本身不内嵌 SQL 执行，纯 shell out）。
  - S3 adapter 是 stub：误以为配好 `ARTIFACT_STORE_*` 就能用 MinIO/OSS 会踩空——adapter 会 throw。
  - migrate 脚本是裸 `psql -f`，不走 `runFrameworkStoreMigrations`（后者带 `framework_schema_migrations` 记账）；脚本路径下靠 SQL 里 `create table if not exists` 幂等，别把两条迁移路径混用。
  - 复用用户另一项目的 PG 实例时，务必用独立 database，`framework_*` 前缀表别污染对方 schema。

- Do not do yet:
  - 不改 `docker-compose.yml` / Dockerfile / Caddy / 阿里云 / 线上 `/opt/source2video/.env`。
  - 不把 Postgres / MinIO 写进部署 compose，不起常驻本地服务。
  - 不接 MinIO/OSS（S3 adapter 未实现），不写 `ARTIFACT_STORE_*` 到生产。
  - 不动 Langfuse（保持 Cloud Free）。
  - 不在本任务里写 provider 代码 / 加 `pg` 依赖 / 跑 migration——这些是 Task 2 的实现工作，本任务只做 readiness。
