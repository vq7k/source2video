# TODO

## 当前 in-progress

无。

## 已收口（本 session）

- [x] `/writing` + `/overview` 全局初始 loading 抖动修复：shared busy skeleton；初始 client 数据加载期间不先闪空态；runtime/typecheck/build/e2e 验证通过
- [x] OpenSpec 13.4：Feedback Ledger -> `writing_dataset_draft`；人工确认 -> `writing_eval_dataset`，draft 不被静默改写
- [x] OpenSpec 13.5：当前不做 Source Store / RAG / workflow builder，继续 Reference Paste + 既有 trace/eval 闭环
- [x] 共享 PostgreSQL 线上切换：`ftai-postgres/source2video_framework` 已开库、迁移、写生产 env、部署并验收
- [x] 旧项目内 PG 移除：线上 compose 已不含 `source2video-postgres`，容器已被 `--remove-orphans` 清理
- [x] Docker Hub rate limit 修复：`a067d24` 改用 `public.ecr.aws/docker/library/node:22-slim`，run `20` 部署成功
- [x] 数据库目标方案校准：本仓移除内置 `source2video-postgres`，改为复用共享 `ftai-postgres` 的独立 database/role
- [x] 线上数据飞轮闭环：run `run_2f8ec678` 完成 confirm / feedback / rule patch / finalize / rule package publish / dataset draft / eval confirm
- [x] OpenSpec 归档：`add-writing-production-system` -> `openspec/changes/archive/2026-06-08-add-writing-production-system/`，主 specs 已生成
- [x] CodeUp run `17` 部署成功：内置 `source2video-postgres` started/healthy，dataset route 从旧 503 变为可落库
- [x] 云效 pipeline config 同步：修复 run `16` 使用旧 deploy script、未展开内层 `deploy.tgz` 的问题
- [x] Docker/route follow-up：`98f08a8`、`709d501` 已 push `origin/main` + `codeup/main`
- [x] Task 8B：Writing provider 接 `FRAMEWORK_DATABASE_URL` -> `createPgSqlClient` -> `createPostgresDatasetRepository`（commit `c91b5f0`）
- [x] Task 8C：一次性 Docker Postgres `5544` migration + env-gated integration test 真实落库通过；容器已清理
- [x] 部署 run `13` 失败已定位：Docker build 缺 `packages/framework-store` dependencies；本地 Docker build 已验证修复
- [x] QA 临时 SubAgent 回报 Task 0 commit review → **PASS**（report.md 已落）
- [x] Infra 临时 SubAgent 回报 Local data plane readiness → env=`FRAMEWORK_DATABASE_URL`（report.md 已落）
- [x] 设计 repository wiring 拆 8A/8B/8C
- [x] Task 8A（FrameworkWorker）pg→FrameworkSqlClient adapter 验收通过（`970e289`）
- [x] 裁决 root `pnpm-lock.yaml`：**不纳管**（Dockerfile `--no-frozen-lockfile`，零风险）

## user/in-progress 文件归属（本次收口不重排）

- [ ] doc-maker docs 同步/提交决断：`07-acceptance.md` / `README.md` / `business-console.md` / `framework-core.md` / `reference/langfuse.md`
- [ ] 未跟踪 docs/skills 文件归属决断：`.agent/skills/`、`skills-lock.json`、若干 `doc-maker/docs/*research*.md` / remediation 文档

## 候选里程碑（待 user 拍板优先级）

- [x] 数据飞轮第一闭环（本地）：人工反馈 → rule package / dataset draft → human-confirmed eval dataset → Postgres dataset item
- [x] 数据飞轮上线：共享 `ftai-postgres` + 线上 dataset route / confirm route 验收
- [ ] framework data plane 本地闭环：root `packages/` contracts → Postgres SOT → worker queue → artifact store → dataset/eval/gate
- [ ] doc-maker writing production 下一阶段范围决断：Topic/Round、规则包、评审闭环、业务 UI 打磨或稳定性增强
- [ ] video-maker 启动设计（如推进：视觉决策 + Remotion 渲染编排）
- [ ] tts-maker 启动设计（如推进，可能复用旧 harness，不一定 source2video-shaped）
- [ ] s2v-core 抽离决断（ADR-023 触发条件 = 第 2 个 LLM workflow 子项目开工）

## 已完成

- [x] 2026-06-05 初始化持久 Agent team：Orchestrator / FrameworkWorker / WritingWorker；Infra / QA 改为临时 SubAgent 范围
- [x] 2026-06-05 部署 Writing Production v1 闭环收口到线上并做 smoke / 业务验收
- [x] 2026-06-05 验收 Writing Adapter Readiness：Writing JSON run/feedback/rule package 可投影为 generic readiness drafts；targeted tests/typecheck passed
- [x] 2026-06-05 验收 WritingWorker Task 7B：Writing dataset draft 可映射为 `FrameworkDatasetItem` 并 append 到 generic dataset repository
- [x] 2026-06-05 验收 WritingWorker Task 7C：Writing dataset draft 可经 service/API route 持久化触发；未配置 repository 时明确 503
- [x] 2026-06-06 验收 FrameworkWorker Task 8A：generic `createPgSqlClient`（pg.Pool → FrameworkSqlClient），TDD 5 tests，commit `970e289`
- [x] 2026-06-08 完成 Writing dataset closure：人工确认 promotion + real Postgres 8C 验证

## 线上运维候选（按需）

- [x] 停用线上旧 `source2video-postgres`：shared DB 已迁移/验收，旧容器已被 compose 清理
- [ ] 为 `source2video_framework` 补逻辑备份/恢复演练（`pg_dump` 单库粒度）
- [ ] 将 `s2v.x-lin7.com` Caddy site block 从生产手工配置同步回网关项目的长期 SOT，避免未来重建 `ftai-caddy` 丢失配置
- [ ] 如继续用 Langfuse 页面验收，安装/启用 Codex Chrome Extension 后可复用 Chrome 登录态验证 trace 页面权限
- [ ] 如需要回滚，重跑云效历史流水线；镜像 tag 使用 `${CI_COMMIT_ID}`，不是裸 `latest`

## 跨 runtime harness 后续完善（agent 自我）

- [ ] 实战验证：下次 cold start（无论 Claude / Codex / Aider）跑一遍 catch-up，看是否真自报角色 + 判 STATUS actionable + 强制升级
- [x] 业务复杂度上升时拆 Worker：FrameworkWorker / WritingWorker 已有持久启动路径；横切 Infra / QA 不建常驻
- [ ] 如多 session 模式形成，补 `.agent/skills/catch-up/SKILL.md` + `.agent/skills/session-summary/SKILL.md`
- [ ] 补项目硬约束（如适用）：隐私 / 化名 / secret 管理等，写入 `.agent/SOUL.md` 末尾段
