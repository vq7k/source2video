# STATUS

## 当前 actionable

**Writing Production 数据飞轮已完成线上全闭环**（2026-06-08）：OpenSpec `add-writing-production-system` 67/67 complete；线上当前仍运行 `709d501 feat(deploy): add postgres data plane` 的内置 `source2video-postgres` 方案；但最新数据库目标方案已改为复用 `from-fullstack-to-ai` 共享 PostgreSQL `ftai-postgres`，本仓配置已准备为强制 `FRAMEWORK_DATABASE_URL`，不再启动项目独立 PG。

线上验收事实：
- `GET https://s2v.x-lin7.com/api/health` → 200；`HEAD /writing` → 200。
- `POST /api/writing-runs/missing-run/dataset-drafts` → 404 `Writing run not found`，说明 repository 已配置，不再是旧的 503。
- 最新保留验收数据 `online-acceptance-2026-06-08-keep-data`：run `run_a51abf14`，candidate `candidate_r1_1`，feedback `feedback_531b81ef`，published package `rule_package_8b0b47cc`。
- dataset draft：`dataset_draft_run_a51abf14_feedback_531b81ef` 写入 `writing_dataset_draft`；human confirm 后 `eval_dataset_item_run_a51abf14_feedback_531b81ef` 写入 `writing_eval_dataset`，split=`validation`。

下一步 actionable：由 infra 在共享 `ftai-postgres` 上 provision 独立 database/role `source2video_framework`，把 `FRAMEWORK_DATABASE_URL=postgresql://source2video_framework:<密码>@ftai-postgres:5432/source2video_framework` 写入 `/opt/source2video/.env`，再部署本仓最新 compose 并验收 dataset route；部署前不要 push CodeUp 触发自动发布。

## 当前阶段

**持久 Agent team 运行中；Writing Production v1 已上线；OpenSpec `add-writing-production-system` 已完成并归档；framework data plane 的 Writing dataset 已在线上真实闭环验证打通；数据库拓扑正在从内置 PG 收敛到共享 `ftai-postgres`**（2026-06-08）。

Agent team：

- Orchestrator：仓库根 `.agent/`
- FrameworkWorker：`packages/.agent/`
- WritingWorker：`doc-maker/.agent/`

横切职责：

- Infra / Deploy / Cloud：临时 SubAgent，由 Orchestrator 从仓库根派发
- QA / Migration / Release Gate：临时 SubAgent，由 Orchestrator 从仓库根派发

上一产品状态：

- 公网入口：`https://s2v.x-lin7.com`
- 默认入口：`/` 重定向/进入 `/writing`
- 部署：CodeUp `main` 自动触发云效流水线 `5006844`
- 最近部署提交：`709d501 feat(deploy): add postgres data plane`；镜像 tag `709d501c`
- 最近部署流水线：`pipelineRunId=17` `SUCCESS`；镜像构建 `SUCCESS`；部署 `SUCCESS`；deployOrderId `63525694`
- 线上验收：`/api/health` ok；`/writing` ok；最新保留验收 run `run_a51abf14` 最终 `finalized`，feedback 1，rule patch 1，published rule package `rule_package_8b0b47cc`，dataset draft/eval confirm 均 200。
- 最新目标拓扑：复用共享 `ftai-postgres`，独立 database/role `source2video_framework`；本仓 `docker-compose.yml` 已移除 `source2video-postgres`，但尚未部署。
- 生产网关修复：`ftai-caddy` 原 Caddyfile 缺少 `s2v.x-lin7.com` HTTPS site block；已在服务器 `/opt/from-fullstack-to-ai/infra/Caddyfile` 追加并 reload，备份为 `Caddyfile.bak.s2v-20260605-085109`。
- 本次本地收口新增：`/writing` 反馈再来一轮 + Rule Package 草稿/发布；`/framework?traceId=` Trace 已定位 + ScoreSink 状态。
- 本地验证：`pnpm test` 4 files / 7 tests passed；`pnpm e2e` 6 passed；`pnpm build` passed。

## 最近一次 session

**2026-06-08 校准数据库拓扑为共享 PostgreSQL**：用户指出最新方案是复用 `/Users/xuelin/projects/from-fullstack-to-ai/infra/docs/shared-database.md` 的共享 `ftai-postgres`，且 `agent-minimal` 已按该方案上线。复核历史发现 2026-06-05 Infra 建议本就写明“用户另一项目已有 PG → 首选复用该实例建独立库，避免新起长期服务；不要写进 compose / 不要常驻”。`709d501` 的内置 PG 是短期上线收口方案，现已改回目标方案：`docker-compose.yml` 不再启动 `source2video-postgres`，改为要求生产显式 `FRAMEWORK_DATABASE_URL`；`docs/deploy.md` 对齐共享库 provision/连接方式；`flow.yml` 不再创建 `data/postgres`。未部署，等待 infra 开库和服务器 env。

**2026-06-08 线上验收并保留测试数据**：按用户要求重新跑公网验收且不清理测试数据。tag=`online-acceptance-2026-06-08-keep-data`；health/page/repository configured 通过；run `run_a51abf14` 完成 confirm、feedback、rule patch、finalize、rule package publish；`writing_dataset_draft` 写入 `dataset_draft_run_a51abf14_feedback_531b81ef`，人工确认后 `writing_eval_dataset` 写入 `eval_dataset_item_run_a51abf14_feedback_531b81ef`；read-back 确认 run status=`finalized`、feedbackCount=1、rulePackageCount=1、containsTag=true。

**2026-06-08 线上完成 Writing dataset / data plane 全闭环**：先提交 `98f08a8` 修复 Docker runtime assets 与 missing-run 404，再提交 `709d501` 增加内置 `source2video-postgres` data plane、生产 lazy migration、pipeline/compose 同步。run `15` 修复线上 500→503；run `16` 成功但云端流水线配置仍旧，未展开内层 `deploy.tgz`，导致仍未部署新 compose；已用 `UpdatePipeline` 同步云效 pipeline config。run `17` 成功部署新 compose，VMDeploy 日志确认 `source2video-postgres` started/healthy。线上 API 闭环 run `run_2f8ec678`：confirm、feedback、rule patch、finalize、rule package publish、`writing_dataset_draft`、`writing_eval_dataset` confirm 全部通过。随后执行 `openspec archive -y add-writing-production-system`，主规格生成 4 个 capability spec，change 归档到 `openspec/changes/archive/2026-06-08-add-writing-production-system/`。

**2026-06-08 完成 Writing dataset closure / 8C 本地闭环**：按 OpenSpec `add-writing-production-system` 剩余 13.4/13.5 推进。TDD 新增人工确认 promotion：`writing_dataset_draft` 仅保留 `needs_human_confirmation` 草稿，`promoteWritingDatasetDraftsForRun()` 要求 `confirmedBy` 后复制进入 `writing_eval_dataset`（`split=validation`、`reviewStatus=human_confirmed`）；新增 `/dataset-drafts/confirm` route。真实 8C 用 `postgres:16-alpine` on `localhost:5544` 应用 migration，10 张表复核通过；env-gated Postgres integration test 真实写入 draft/eval dataset 各 1 条；容器已清理。

**2026-06-08 部署 follow-up**：push `849eacc` 后 CodeUp pipeline run `13` 在镜像构建阶段失败；云效日志显示容器内测试找不到 `pg`（`/app/packages/framework-store/src/pg-client.ts` import）。根因是 Dockerfile 只安装 `doc-maker/ui` dependencies，未安装 root `packages/framework-store` dependencies。已补 Dockerfile deps stage 安装/copy `packages/framework-store/node_modules`，并新增 topology test；本地 `docker build -t source2video:deploy-verify .` 通过。

**2026-06-06 推进 repository wiring（QA/Infra 回报 + Task 8A 验收）**：(1) 派 QA 临时 SubAgent 复验 Task 0 `bda65dd` → PASS（拓扑干净，topology 5/5、test 30/30、typecheck 0；唯一非阻塞发现：Dockerfile `COPY packages` 是后续 `521f3c2` 才补，HEAD 已修复）。(2) 派 Infra 临时 SubAgent 出 local data plane readiness → 唯一必需 env=`FRAMEWORK_DATABASE_URL`，Postgres 接线代码已就绪，artifact filesystem first。(3) 设计 repository wiring 拆 8A/8B/8C，派 FrameworkWorker Task 8A：subagent 中途 ECONNRESET 但已完整完成并提交 `970e289`，自验通过、状态收尾、主动升级 lockfile。(4) Orchestrator 验收 8A 通过；裁决 lockfile **不纳管**（Dockerfile 用 `--no-frozen-lockfile`，零风险）。下一步派 8B。

**2026-06-05 解除 FrameworkWorker 高频 review 卡点**：FrameworkWorker 已完成 Task 1 并提交 `5f12449`。Orchestrator 改派 Task 2 → Task 3 store lane，允许 Worker 每个 task 验证/提交后自动进入下一 task；只有失败、越界、需要 push/部署时才回报。

**2026-06-05 验收 Writing Adapter Readiness**：WritingWorker 新增 `adapter-readiness.ts` 和 `writing-adapter-readiness.test.ts`，将 Writing JSON run/feedback/rule package 投影为 workflow run、rule package draft、dataset draft item，并产出 FrameworkWorker needs。Orchestrator 复验 targeted tests/typecheck 通过；当前全量 `pnpm test` 失败来自 FrameworkWorker Task2 migration 红测，不归 Writing readiness。

**2026-06-05 验收 Store Lane Task 2/3 并派发 Task 4/5**：FrameworkWorker 提交 `379c20b feat(framework): add postgres schema migrations` 与 `307020b feat(framework): persist workflow runs in postgres`。Orchestrator 复验 `framework-store.test.ts` 6 passed、`pnpm test` 7 files / 18 tests passed、`pnpm typecheck`、`git diff --check`、业务命名扫描无命中。已派发 Task 4 → Task 5 连续 lane。

**2026-06-05 验收 Artifact/Runtime Lane Task 4/5 并派发 Task 7A**：FrameworkWorker 提交 `a73a8db feat(framework): add artifact store abstraction` 与 `412c890 feat(framework): add postgres-backed worker runtime`。Orchestrator 复验 worker+store 11 passed、`pnpm test` 8 files / 23 tests passed、`pnpm typecheck`、`git diff --check`、根目录业务命名扫描无命中。已派发 Task 7A generic dataset repository，明确不碰 Writing adapter/API route。

**2026-06-05 验收 Task 7A 并派发 Task 7B**：FrameworkWorker 提交 `55cd28e feat(framework): persist dataset drafts`。Orchestrator 复验 dataset+store 9 passed、`pnpm test` 9 files / 25 tests passed、`pnpm typecheck`、`git diff --check`、根目录业务命名扫描无命中。已派发 WritingWorker Task 7B：Writing dataset draft -> `FrameworkDatasetItem`，明确不改 root `packages/**`。

**2026-06-05 验收 Task 7B**：WritingWorker 提交 `24d323f feat(writing): adapt dataset drafts to framework items`。新增 `writingDatasetDraftItemToFrameworkDatasetItem`，并用 fake SQL client 验证可 append 到 `createPostgresDatasetRepository`。Orchestrator 复验 targeted 2 files / 4 tests、`pnpm test` 9 files / 26 tests、`pnpm typecheck`、`git diff --check` 全通过；commit 未包含 root `packages/**`。

**2026-06-05 验收 Task 7C**：WritingWorker 提交 `2368e0e feat(writing): persist dataset drafts through api flow`。新增 `persistWritingDatasetDraftsForRun()`、`/api/writing-runs/[runId]/dataset-drafts` POST route 和 repository provider 注入；未配置 repository 时返回明确 503。Orchestrator 复验 targeted 3 files / 7 tests、`pnpm test` 10 files / 29 tests、`pnpm typecheck`、`git diff --check` 全通过；commit 未包含 root `packages/**`。

**2026-06-05 部署 framework topology / Writing dataset flow**：push CodeUp `main` 到 `c883049` 触发 `pipelineRunId=10`，镜像构建失败；根因是 Dockerfile builder 只复制 `doc-maker/**`，未复制 root `packages/**`，导致容器内测试找不到 `/app/packages/**`。已用 TDD 增加 Dockerfile topology 断言并提交 `521f3c2 fix(deploy): include framework packages in docker build`；本地 `docker build -t source2video:deploy-verify .` 通过，CodeUp `main` 触发 `pipelineRunId=11` 成功。线上验收：`/api/health` 200、`/writing` 200、`POST /api/writing-runs/missing-run/dataset-drafts` 返回预期 `503 repository_unconfigured`。

**2026-06-05 线上复验**：云效 `pipelineRunId=11` 仍为 `SUCCESS`，CodeUp `main` 为 `521f3c2`。公网复验：`/api/health` 200，`/` 307 -> `/writing`，`/writing` 200。真实业务闭环 run `run_7c60ffa4` 已跑通：`candidate_ready` 3 candidates，最终 `finalized`，feedback 1，rule patch 1，published rule package `rule_package_2461058a`（10 rules），LLM traces 10，framework runs 11，Langfuse trace `ef369696-62d7-481c-a17c-4ee0fd3d238e`。`/framework` trace deep link 浏览器验证显示“Trace 已定位”。dataset route 当前按设计返回 `503 repository_unconfigured`。

上一 session：**2026-06-05 持久 Agent team 初始化**：将项目从单 Orchestrator/Engineer 运行方式升级为持久 Agent team；新版规则下仅保留有独立 cwd 的 FrameworkWorker / WritingWorker；Infra / QA 改为临时 SubAgent 范围；明确 framework 归属仓库根 `packages/`，Writing 仅作为第一个业务 adapter。

再上一 session：**2026-06-05 Writing Production v1 上线验收**：本地测试/构建通过后 push CodeUp `main`，云效流水线 `8` 成功；修复生产 Caddy 缺失 `s2v.x-lin7.com` site block 导致的公网 TLS 握手失败；线上 health、页面、LLM runtime、业务 run、Langfuse/ScoreSink、framework 深链均验收通过。

归档：[`sessions/2026-06-05-writing-production-online/`](./sessions/2026-06-05-writing-production-online/)

上一归档：[`sessions/2026-06-04-writing-v1-closure/`](./sessions/2026-06-04-writing-v1-closure/)

## 阻塞

无。

## 引用

- 项目身份: [`../PROJECT.md`](../PROJECT.md)
- 仓拓扑: [`../docs/repo-layout.md`](../docs/repo-layout.md)
- 仓级 ADR: [`../docs/ADRs/`](../docs/ADRs/)
- doc-maker: [`../doc-maker/CLAUDE.md`](../doc-maker/CLAUDE.md)
- 部署文档: [`../docs/deploy.md`](../docs/deploy.md)
- OpenSpec 变更: [`../openspec/`](../openspec/)
- 项目级 SOP: [`./skills/`](./skills/)
- 任务清单: [`./TODO.md`](./TODO.md)
- learned-rules: [`./learned-rules.md`](./learned-rules.md)
